"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  orderBy,
  addDoc,
  setDoc,
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
import type { User, Project, Task, Message, ProjectChannel, Priority, TaskStatus } from "../types";
import {
  memberDocToUser,
  projectFromFirestore,
  projectChannelFromFirestore,
  taskFromFirestore,
  messageFromFirestore,
  toIso,
} from "../lib/firestoreMappers";
import {
  filterProjectsForUser,
  filterTasksForAccessibleProjects,
  isWorkspaceOwnerRole,
} from "../lib/projectAccess";
import { chunkIds, directMessageChannelId } from "../lib/chatChannels";

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
  projectChannels: ProjectChannel[];
  createSubChannel: (projectId: string, name: string) => Promise<void>;
  activeModals: { [key: string]: boolean };
  toggleModal: (modalId: string, isOpen: boolean) => void;
  updateTaskState: (taskId: string, updates: Partial<Task>) => Promise<void>;
  addComment: (taskId: string, content: string) => Promise<void>;
  sendMessage: (channelId: string, content: string) => Promise<void>;
  toggleMessageReaction: (messageId: string, emoji: string) => Promise<void>;
  setTyping: (channelId: string, isTyping: boolean) => Promise<void>;
  typingUsersByChannel: Record<string, string[]>;
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
  const [typingUsersByChannel, setTypingUsersByChannel] = useState<Record<string, string[]>>({});
  const [projectChannels, setProjectChannels] = useState<ProjectChannel[]>([]);
  const [activeModals, setActiveModals] = useState<{ [key: string]: boolean }>({});
  const [projectsRetryTick, setProjectsRetryTick] = useState(0);
  const projectsRetryAttemptedRef = useRef(false);

  const db = getFirebaseDb();

  useEffect(() => {
    if (!db || !workspaceId || !user) return;

    const memberRef = doc(db, "workspaces", workspaceId, "members", user.uid);

    const markPresence = async (isOnline: boolean) => {
      try {
        await setDoc(
          memberRef,
          {
            isOnline,
            lastSeenAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (err) {
        console.warn("[AppContext] presence update failed", err);
      }
    };

    void markPresence(true);

    const heartbeat = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void markPresence(true);
      }
    }, 60000);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void markPresence(true);
      } else {
        void markPresence(false);
      }
    };

    const onOnline = () => {
      void markPresence(true);
    };

    const onOffline = () => {
      void markPresence(false);
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      window.clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      void markPresence(false);
    };
  }, [db, workspaceId, user]);

  useEffect(() => {
    if (!db || !workspaceId) {
      setMembersSnapshotReady(false);
      setUsers([]);
      return;
    }

    // Clear stale data when switching workspaces; otherwise downstream listeners may
    // run with old `users/projects` and hit permission errors.
    setUsers([]);
    setAllProjects([]);
    setAllTasks([]);
    setMessages([]);
    setTypingUsersByChannel({});
    setProjectChannels([]);
    setMembersSnapshotReady(false);
    console.debug("[AppContext] subscribing to members collection", { workspaceId, uid: user?.uid });
    return onSnapshot(
      collection(db, "workspaces", workspaceId, "members"),
      (snap) => {
        const list: User[] = [];
        snap.forEach((d) => {
          const raw = d.data() as Record<string, unknown>;
          list.push(memberDocToUser(d.id, raw));
        });
        console.debug("[AppContext] members snapshot OK", { count: list.length, ids: list.map((u) => u.id) });
        setUsers(list);
        setMembersSnapshotReady(true);
      },
      (err) => {
        console.error("[AppContext] ❌ members listener FAILED — this is the permissions error source:", err, { workspaceId, uid: user?.uid });
        setUsers([]);
        setAllProjects([]);
        setAllTasks([]);
        setMessages([]);
        setTypingUsersByChannel({});
        setProjectChannels([]);
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

    // Every project is created with the creator in the team (enforced by Firestore create rule),
    // so array-contains returns all projects for both owners and invited members.
    // Unfiltered collection reads are avoided — Firestore cannot statically prove those safe.
    const projectsQ = query(
      collection(db, "workspaces", workspaceId, "projects"),
      where("team", "array-contains", user.uid)
    );

    console.debug("[AppContext] subscribing to projects collection", { workspaceId, uid: user.uid, isOwner });
    return onSnapshot(
      projectsQ,
      (snap) => {
        const list: Project[] = [];
        snap.forEach((d) => {
          list.push(projectFromFirestore(d.id, d.data() as Record<string, unknown>));
        });
        list.sort((a, b) => a.name.localeCompare(b.name));
        console.debug("[AppContext] projects snapshot OK", { count: list.length, isOwner });
        setAllProjects(list);
      },
      (err) => {
        console.error("[AppContext] ❌ projects listener FAILED:", err, {
          workspaceId,
          uid: user.uid,
          membersSnapshotReady,
          hasWorkspaceAccess,
          usersCount: users.length,
          isOwner,
        });

        // One-shot recovery: invite acceptance writes may not be visible to the client yet.
        // For permission-related failures, force a token refresh and retry the listener once.
        const code = (err as { code?: string }).code;
        const message = (err as { message?: string }).message;
        const permissionDenied =
          code === "permission-denied" || (typeof message === "string" && message.toLowerCase().includes("permission"));

        if (permissionDenied && !projectsRetryAttemptedRef.current) {
          projectsRetryAttemptedRef.current = true;
          window.setTimeout(async () => {
            try {
              await user.getIdToken(true);
              setProjectsRetryTick((t) => t + 1);
            } catch {
              // If token refresh fails, let the listener fail quietly.
            }
          }, 2000);
        }
      }
    );
  }, [db, workspaceId, user, users, membersSnapshotReady, hasWorkspaceAccess, projectsRetryTick]);

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

  // Project channels: scoped to projects the user is on.
  useEffect(() => {
    if (!db || !workspaceId) return;

    const projectIds = allProjects.map((p) => p.id);
    if (projectIds.length === 0) {
      setProjectChannels([]);
      return;
    }

    setProjectChannels([]);
    const chunks = chunkIds(projectIds);
    const unsubs = chunks.map((chunk) => {
      const chunkSet = new Set(chunk);
      const channelsQ = query(
        collection(db, "workspaces", workspaceId, "projectChannels"),
        where("projectId", "in", chunk)
      );
      return onSnapshot(
        channelsQ,
        (snap) => {
          const chunkChannels: ProjectChannel[] = [];
          snap.forEach((d) => {
            chunkChannels.push(projectChannelFromFirestore(d.id, d.data() as Record<string, unknown>));
          });
          setProjectChannels((prev) => {
            const rest = prev.filter((ch) => !chunkSet.has(ch.projectId));
            const merged = [...rest, ...chunkChannels];
            merged.sort((a, b) => {
              if (a.projectId !== b.projectId) return a.projectId.localeCompare(b.projectId);
              if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
              return a.name.localeCompare(b.name);
            });
            return merged;
          });
        },
        (err) => console.error("[AppContext] projectChannels listener:", err)
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

    const projectPeerIds = new Set<string>();
    for (const p of allProjects) {
      for (const memberId of p.team) {
        if (memberId !== uid) projectPeerIds.add(memberId);
      }
    }

    const channelIds: string[] = projectChannels.map((ch) => ch.id);
    for (const peerId of projectPeerIds) {
      channelIds.push(directMessageChannelId(uid, peerId));
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
  }, [db, workspaceId, user, users, allProjects, projectChannels, membersSnapshotReady, hasWorkspaceAccess]);

  // Typing states: scoped by channelId and user project membership.
  useEffect(() => {
    if (!db || !workspaceId || !user || !membersSnapshotReady || !hasWorkspaceAccess) {
      if (!hasWorkspaceAccess) setTypingUsersByChannel({});
      return;
    }

    const uid = user.uid;

    const projectPeerIds = new Set<string>();
    for (const p of allProjects) {
      for (const memberId of p.team) {
        if (memberId !== uid) projectPeerIds.add(memberId);
      }
    }

    const channelIds: string[] = projectChannels.map((ch) => ch.id);
    for (const peerId of projectPeerIds) {
      channelIds.push(directMessageChannelId(uid, peerId));
    }

    if (channelIds.length === 0) {
      setTypingUsersByChannel({});
      return;
    }

    setTypingUsersByChannel({});
    const unsubs = channelIds.map((channelId) =>
      onSnapshot(
        query(
          collection(db, "workspaces", workspaceId, "typingStates"),
          where("channelId", "==", channelId)
        ),
        (snap) => {
          const nowMs = Date.now();
          const typingIds = new Set<string>();
          snap.forEach((d) => {
            const data = d.data() as Record<string, unknown>;
            const userId = typeof data.userId === "string" ? data.userId : "";
            const isTyping = data.isTyping === true;
            if (!userId || userId === uid || !isTyping) return;
            const updatedAtMs = new Date(toIso(data.updatedAt)).getTime();
            if (Number.isNaN(updatedAtMs) || nowMs - updatedAtMs > 10000) return;
            typingIds.add(userId);
          });
          setTypingUsersByChannel((prev) => ({ ...prev, [channelId]: Array.from(typingIds) }));
        },
        (err) => console.error(`[AppContext] typingStates listener (${channelId}):`, err)
      )
    );

    return () => unsubs.forEach((u) => u());
  }, [db, workspaceId, user, allProjects, projectChannels, membersSnapshotReady, hasWorkspaceAccess]);

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
      const projectRef = await addDoc(collection(db, "workspaces", workspaceId, "projects"), payload);
      await setDoc(doc(db, "workspaces", workspaceId, "projectChannels", projectRef.id), {
        projectId: projectRef.id,
        name: projectData.name,
        isDefault: true,
        createdAt: serverTimestamp(),
        createdBy: user.uid,
      });
    },
    [db, workspaceId, user]
  );

  const createSubChannel = useCallback(
    async (projectId: string, name: string) => {
      if (!db || !workspaceId || !user) return;
      const trimmed = name.trim();
      if (!trimmed) return;
      await addDoc(collection(db, "workspaces", workspaceId, "projectChannels"), {
        projectId,
        name: trimmed,
        isDefault: false,
        createdAt: serverTimestamp(),
        createdBy: user.uid,
      });
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

  const toggleMessageReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (!db || !workspaceId || !user || !messageId) return;
      const reaction = emoji.trim();
      if (!reaction) return;
      const ref = doc(db, "workspaces", workspaceId, "messages", messageId);
      await runTransaction(db, async (txn) => {
        const snap = await txn.get(ref);
        if (!snap.exists()) return;
        const data = snap.data() as Record<string, unknown>;
        const rawReactions = data.reactions;
        const reactions: Record<string, string[]> = {};
        if (rawReactions && typeof rawReactions === "object") {
          Object.entries(rawReactions as Record<string, unknown>).forEach(([key, value]) => {
            if (!Array.isArray(value)) return;
            reactions[key] = value.filter((entry): entry is string => typeof entry === "string");
          });
        }
        const currentUsers = reactions[reaction] ?? [];
        const hasReacted = currentUsers.includes(user.uid);
        const nextUsers = hasReacted
          ? currentUsers.filter((uid) => uid !== user.uid)
          : [...currentUsers, user.uid];
        if (nextUsers.length === 0) {
          delete reactions[reaction];
        } else {
          reactions[reaction] = nextUsers;
        }
        txn.update(ref, { reactions });
      });
    },
    [db, workspaceId, user]
  );

  const setTyping = useCallback(
    async (channelId: string, isTyping: boolean) => {
      if (!db || !workspaceId || !user || !channelId) return;
      const safeChannelId = encodeURIComponent(channelId);
      const typingId = `${user.uid}__${safeChannelId}`;
      await setDoc(
        doc(db, "workspaces", workspaceId, "typingStates", typingId),
        {
          channelId,
          userId: user.uid,
          isTyping,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
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
        projectChannels,
        createSubChannel,
        activeModals,
        toggleModal,
        updateTaskState,
        addComment,
        sendMessage,
        toggleMessageReaction,
        setTyping,
        typingUsersByChannel,
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
