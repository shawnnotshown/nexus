"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  orderBy,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  writeBatch,
  serverTimestamp,
  runTransaction,
  where,
  deleteDoc,
  type DocumentData,
} from "firebase/firestore";
import { getFirebaseDb } from "../lib/firebase";
import { useAuth } from "./AuthContext";
import { useWorkspace } from "./WorkspaceContext";
import type { User, Project, Task, Message, Priority, TaskStatus } from "../types";
import {
  memberDocToUser,
  projectFromFirestore,
  taskFromFirestore,
  messageFromFirestore,
} from "../lib/firestoreMappers";
import {
  filterProjectsForUser,
  filterTasksForAccessibleProjects,
  isWorkspaceOwnerRole,
} from "../lib/projectAccess";
import { WORKSPACE_CHANNELS, chunkIds, directMessageChannelId } from "../lib/chatChannels";

export interface ProfileUpdates {
  name?: string;
  title?: string;
  location?: string;
  bio?: string;
}

interface AppContextType {
  currentUser: User;
  users: User[];
  projects: Project[];
  tasks: Task[];
  messages: Message[];
  activeModals: { [key: string]: boolean };
  toggleModal: (modalId: string, isOpen: boolean) => void;
  updateTaskState: (taskId: string, updates: Partial<Task>) => Promise<void>;
  addComment: (taskId: string, content: string) => Promise<void>;
  sendMessage: (channelId: string, content: string) => Promise<void>;
  addXP: (amount: number) => Promise<void>;
  addProject: (project: Omit<Project, "id">) => Promise<void>;
  deleteProject?: (id: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  addTask: (input: {
    projectId: string;
    title: string;
    description?: string;
    status?: TaskStatus;
    priority?: Priority;
    assignees?: string[];
    dueDate?: string;
  }) => Promise<string | undefined>;
  updateProfile: (updates: ProfileUpdates) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const { workspaceId } = useWorkspace();
  const [users, setUsers] = useState<User[]>([]);
  const [membersSnapshotReady, setMembersSnapshotReady] = useState(false);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeModals, setActiveModals] = useState<{ [key: string]: boolean }>({});

  const db = getFirebaseDb();

  useEffect(() => {
    if (!db || !workspaceId) {
      setMembersSnapshotReady(false);
      setUsers([]);
      return;
    }

    setMembersSnapshotReady(false);
    return onSnapshot(
      collection(db, "workspaces", workspaceId, "members"),
      (snap) => {
        const list: User[] = [];
        snap.forEach((d) => {
          const raw = d.data() as Record<string, unknown>;
          list.push(memberDocToUser(d.id, raw));
        });
        setUsers(list);
        setMembersSnapshotReady(true);
      },
      (err) => {
        console.error("[AppContext] members listener:", err);
        setMembersSnapshotReady(true);
      }
    );
  }, [db, workspaceId]);

  const hasWorkspaceAccess = useMemo(() => {
    if (!user || !workspaceId) return false;
    if (workspaceId === user.uid) return true;
    return users.some((m) => m.id === user.uid);
  }, [user, workspaceId, users]);

  // Owners may list all projects; invited members must query team array-contains or Firestore denies the listener.
  useEffect(() => {
    if (!db || !workspaceId || !user || !membersSnapshotReady || !hasWorkspaceAccess) {
      if (!hasWorkspaceAccess) setAllProjects([]);
      return;
    }

    const member = users.find((m) => m.id === user.uid);
    const isOwner = workspaceId === user.uid || isWorkspaceOwnerRole(member?.role);

    const projectsCol = collection(db, "workspaces", workspaceId, "projects");
    const projectsQ = isOwner
      ? projectsCol
      : query(projectsCol, where("team", "array-contains", user.uid));

    return onSnapshot(
      projectsQ,
      (snap) => {
        const list: Project[] = [];
        snap.forEach((d) => {
          list.push(projectFromFirestore(d.id, d.data() as Record<string, unknown>));
        });
        list.sort((a, b) => a.name.localeCompare(b.name));
        setAllProjects(list);
      },
      (err) => console.error("[AppContext] projects listener:", err)
    );
  }, [db, workspaceId, user, users, membersSnapshotReady, hasWorkspaceAccess]);

  // Tasks: rules scope by projectId — must query with `in` chunks, not the whole collection.
  useEffect(() => {
    if (!db || !workspaceId) return;

    const projectIds = allProjects.map((p) => p.id);
    if (projectIds.length === 0) {
      setAllTasks([]);
      return;
    }

    setAllTasks([]);
    const chunks = chunkIds(projectIds);
    const unsubs = chunks.map((chunk) => {
      const chunkSet = new Set(chunk);
      const tasksQ = query(
        collection(db, "workspaces", workspaceId, "tasks"),
        where("projectId", "in", chunk)
      );
      return onSnapshot(
        tasksQ,
        (snap) => {
          const chunkTasks: Task[] = [];
          snap.forEach((d) => {
            chunkTasks.push(taskFromFirestore(d.id, d.data() as Record<string, unknown>));
          });
          setAllTasks((prev) => {
            const rest = prev.filter((t) => !chunkSet.has(t.projectId));
            return [...rest, ...chunkTasks];
          });
        },
        (err) => console.error("[AppContext] tasks listener:", err)
      );
    });

    return () => unsubs.forEach((u) => u());
  }, [db, workspaceId, allProjects]);

  // Messages: rules scope by channelId — subscribe per channel, not the whole collection.
  useEffect(() => {
    if (!db || !workspaceId || !user || !membersSnapshotReady || !hasWorkspaceAccess) {
      if (!hasWorkspaceAccess) setMessages([]);
      return;
    }

    const uid = user.uid;

    const channelIds: string[] = [];
    for (const ch of WORKSPACE_CHANNELS) channelIds.push(ch.id);
    for (const peer of users) {
      if (peer.id === uid) continue;
      channelIds.push(directMessageChannelId(uid, peer.id));
    }

    if (channelIds.length === 0) {
      setMessages([]);
      return;
    }

    setMessages([]);
    const unsubs = channelIds.map((channelId) =>
      onSnapshot(
        query(
          collection(db, "workspaces", workspaceId, "messages"),
          where("channelId", "==", channelId)
        ),
        (snap) => {
          const channelMessages: Message[] = [];
          snap.forEach((d) => {
            channelMessages.push(messageFromFirestore(d.id, d.data() as Record<string, unknown>));
          });
          channelMessages.sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
          setMessages((prev) => {
            const rest = prev.filter((m) => m.channelId !== channelId);
            return [...rest, ...channelMessages].sort(
              (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
          });
        },
        (err) => console.error(`[AppContext] messages listener (${channelId}):`, err)
      )
    );

    return () => unsubs.forEach((u) => u());
  }, [db, workspaceId, user, users, membersSnapshotReady, hasWorkspaceAccess]);

  const currentUser = useMemo((): User => {
    const u = user;
    if (!u) {
      return {
        id: "",
        name: "Guest",
        avatar: "",
        xp: 0,
        level: 1,
        role: "Member",
        badges: [],
      };
    }
    const member = users.find((m) => m.id === u.uid);
    if (member) {
      return {
        ...member,
        email: member.email ?? u.email ?? undefined,
      };
    }
    return {
      id: u.uid,
      name: u.displayName ?? "User",
      avatar: u.photoURL ?? "",
      xp: 0,
      level: 1,
      role: "Member",
      badges: [],
      email: u.email ?? undefined,
    };
  }, [user, users]);

  const isWorkspaceOwner = isWorkspaceOwnerRole(currentUser.role);

  const projects = useMemo(
    () => filterProjectsForUser(allProjects, user?.uid ?? "", isWorkspaceOwner),
    [allProjects, user?.uid, isWorkspaceOwner]
  );

  const accessibleProjectIds = useMemo(() => new Set(projects.map((p) => p.id)), [projects]);

  const tasks = useMemo(
    () => filterTasksForAccessibleProjects(allTasks, accessibleProjectIds),
    [allTasks, accessibleProjectIds]
  );

  const awardXp = useCallback(
    async (uid: string, amount: number) => {
      if (!db || !workspaceId) return;
      const mref = doc(db, "workspaces", workspaceId, "members", uid);
      await runTransaction(db, async (txn) => {
        const m = await txn.get(mref);
        const prevXp = typeof m.data()?.xp === "number" ? m.data()!.xp : 0;
        const xp = prevXp + amount;
        const level = Math.floor(xp / 500) + 1;
        txn.update(mref, { xp, level });
      });
    },
    [db, workspaceId]
  );

  const addProject = useCallback(
    async (projectData: Omit<Project, "id">) => {
      if (!db || !workspaceId || !user) return;
      const team = projectData.team?.length ? projectData.team : [user.uid];
      const payload: Record<string, unknown> = {
        name: projectData.name,
        description: projectData.description,
        progress: projectData.progress,
        team,
      };
      if (projectData.dueDate) payload.dueDate = projectData.dueDate;
      await addDoc(collection(db, "workspaces", workspaceId, "projects"), payload);
    },
    [db, workspaceId, user]
  );

  const deleteProject = useCallback(
    async (id: string) => {
      if (!db || !workspaceId) return;
      const batch = writeBatch(db);
      const tasksSnap = await getDocs(
        query(collection(db, "workspaces", workspaceId, "tasks"), where("projectId", "==", id))
      );
      tasksSnap.forEach((d) => batch.delete(d.ref));
      batch.delete(doc(db, "workspaces", workspaceId, "projects", id));
      await batch.commit();
    },
    [db, workspaceId]
  );

  const deleteTask = useCallback(
    async (id: string) => {
      if (!db || !workspaceId) return;
      await deleteDoc(doc(db, "workspaces", workspaceId, "tasks", id));
    },
    [db, workspaceId]
  );

  const addTask = useCallback(
    async (input: {
      projectId: string;
      title: string;
      description?: string;
      status?: TaskStatus;
      priority?: Priority;
      assignees?: string[];
      dueDate?: string;
    }) => {
      if (!db || !workspaceId || !user) return undefined;
      const title = input.title.trim();
      if (!title) return undefined;
      const status = input.status ?? "todo";
      const assignees =
        input.assignees && input.assignees.length > 0 ? input.assignees : [user.uid];
      const due = input.dueDate ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const ref = await addDoc(collection(db, "workspaces", workspaceId, "tasks"), {
        projectId: input.projectId,
        title,
        description: (input.description ?? "").trim(),
        status,
        priority: input.priority ?? "medium",
        assignees,
        dueDate: due,
        completed: status === "done",
        comments: [],
        subtasks: [],
        dependencies: [],
        timeTracked: 0,
      });
      return ref.id;
    },
    [db, workspaceId, user]
  );

  const toggleModal = useCallback((modalId: string, isOpen: boolean) => {
    setActiveModals((prev) => ({ ...prev, [modalId]: isOpen }));
  }, []);

  const addXP = useCallback(
    async (amount: number) => {
      if (!user) return;
      await awardXp(user.uid, amount);
    },
    [user, awardXp]
  );

  const updateTaskState = useCallback(
    async (taskId: string, updates: Partial<Task>) => {
      if (!db || !workspaceId || !user) return;
      const ref = doc(db, "workspaces", workspaceId, "tasks", taskId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
      const prev = taskFromFirestore(snap.id, snap.data() as Record<string, unknown>);

      const payload: Record<string, unknown> = {};
      (Object.keys(updates) as (keyof Task)[]).forEach((k) => {
        if (k === "id") return;
        const v = updates[k];
        if (v !== undefined) payload[k as string] = v as unknown;
      });

      if (updates.status !== undefined) {
        payload.completed = updates.status === "done";
      }

      await updateDoc(ref, payload as DocumentData);

      if (updates.status === "done" && prev.status !== "done") {
        await awardXp(user.uid, 50);
      }
    },
    [db, workspaceId, user, awardXp]
  );

  const addComment = useCallback(
    async (taskId: string, content: string) => {
      if (!db || !workspaceId || !user) return;
      const ref = doc(db, "workspaces", workspaceId, "tasks", taskId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
      const prev = taskFromFirestore(snap.id, snap.data() as Record<string, unknown>);
      const newComment = {
        id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
        userId: user.uid,
        content,
        createdAt: new Date().toISOString(),
      };
      await updateDoc(ref, { comments: [...prev.comments, newComment] });
    },
    [db, workspaceId, user]
  );

  const updateProfile = useCallback(
    async (updates: ProfileUpdates) => {
      if (!db || !workspaceId || !user) return;

      const memberPayload: Record<string, unknown> = {};
      const userPayload: Record<string, unknown> = {};

      if (updates.name !== undefined) {
        const trimmed = updates.name.trim();
        if (trimmed.length === 0) {
          throw new Error("Name is required.");
        }
        memberPayload.name = trimmed;
        memberPayload.displayName = trimmed;
        userPayload.displayName = trimmed;
      }

      const optionalKeys: Array<keyof ProfileUpdates> = ["title", "location", "bio"];
      optionalKeys.forEach((key) => {
        const value = updates[key];
        if (value === undefined) return;
        memberPayload[key] = value.trim();
      });

      if (Object.keys(memberPayload).length > 0) {
        await updateDoc(
          doc(db, "workspaces", workspaceId, "members", user.uid),
          memberPayload as DocumentData
        );
      }

      if (Object.keys(userPayload).length > 0) {
        await updateDoc(doc(db, "users", user.uid), userPayload as DocumentData);
      }
    },
    [db, workspaceId, user]
  );

  const sendMessage = useCallback(
    async (channelId: string, content: string) => {
      if (!db || !workspaceId || !user) return;
      await addDoc(collection(db, "workspaces", workspaceId, "messages"), {
        channelId,
        userId: user.uid,
        content,
        createdAt: serverTimestamp(),
      });
    },
    [db, workspaceId, user]
  );

  return (
    <AppContext.Provider
      value={{
        currentUser,
        users,
        projects,
        tasks,
        messages,
        activeModals,
        toggleModal,
        updateTaskState,
        addComment,
        sendMessage,
        addXP,
        addProject,
        deleteProject,
        deleteTask,
        addTask,
        updateProfile,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useAppContext must be used within AppProvider");
  return context;
};
