"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { getFirebaseDb, getFirebaseStorage } from "../lib/firebase";
import { useWorkspace } from "../context/WorkspaceContext";
import { useAuth } from "../context/AuthContext";
import { normalizeAssignees, projectTodoItemFromFirestore, toIso } from "../lib/firestoreMappers";
import type {
  Comment,
  ProjectBoardComment,
  ProjectBoardThread,
  ProjectFileMeta,
  ProjectScheduleEvent,
  ProjectTodoItem,
  ProjectTodoList,
} from "../types";

function mapThread(id: string, data: Record<string, unknown>): ProjectBoardThread {
  return {
    id,
    title: String(data.title ?? ""),
    content: String(data.content ?? ""),
    userId: String(data.userId ?? ""),
    createdAt: toIso(data.createdAt),
    commentCount: typeof data.commentCount === "number" ? data.commentCount : 0,
  };
}

function mapFile(id: string, data: Record<string, unknown>): ProjectFileMeta {
  return {
    id,
    name: String(data.name ?? ""),
    storagePath: String(data.storagePath ?? ""),
    downloadURL: String(data.downloadURL ?? ""),
    contentType: String(data.contentType ?? "application/octet-stream"),
    size: typeof data.size === "number" ? data.size : 0,
    uploadedAt: toIso(data.uploadedAt),
    uploadedBy: String(data.uploadedBy ?? ""),
  };
}

function mapScheduleEvent(id: string, data: Record<string, unknown>): ProjectScheduleEvent {
  const reminderSentAt = data.reminderSentAt != null ? toIso(data.reminderSentAt) : undefined;
  return {
    id,
    title: String(data.title ?? ""),
    notes: String(data.notes ?? ""),
    eventDate: toIso(data.eventDate),
    createdBy: String(data.createdBy ?? ""),
    ...(reminderSentAt ? { reminderSentAt } : {}),
  };
}

export function useProjectExtras(projectId: string | null, activeThreadId: string | null) {
  const { workspaceId } = useWorkspace();
  const { user } = useAuth();
  const db = getFirebaseDb();
  const storage = getFirebaseStorage();

  const [listRows, setListRows] = useState<{ id: string; name: string; order: number }[]>([]);
  const [items, setItems] = useState<ProjectTodoItem[]>([]);
  const [threads, setThreads] = useState<ProjectBoardThread[]>([]);
  const [files, setFiles] = useState<ProjectFileMeta[]>([]);
  const [scheduleEvents, setScheduleEvents] = useState<ProjectScheduleEvent[]>([]);
  const [threadComments, setThreadComments] = useState<ProjectBoardComment[]>([]);
  const [ready, setReady] = useState(false);

  const basePathOk = Boolean(db && workspaceId && projectId);

  useEffect(() => {
    if (!db || !workspaceId || !projectId) {
      setListRows([]);
      setItems([]);
      setThreads([]);
      setFiles([]);
      setScheduleEvents([]);
      setReady(true);
      return;
    }

    setReady(false);
    const todoListsCol = collection(db, "workspaces", workspaceId, "projects", projectId, "todoLists");
    const todoItemsCol = collection(db, "workspaces", workspaceId, "projects", projectId, "todoItems");
    const boardThreadsCol = collection(db, "workspaces", workspaceId, "projects", projectId, "boardThreads");
    const filesCol = collection(db, "workspaces", workspaceId, "projects", projectId, "files");
    const scheduleEventsCol = collection(db, "workspaces", workspaceId, "projects", projectId, "scheduleEvents");

    const unsubs: (() => void)[] = [];

    unsubs.push(
      onSnapshot(query(todoListsCol, orderBy("order", "asc")), (snap) => {
        const rows: { id: string; name: string; order: number }[] = [];
        snap.forEach((d) => {
          const data = d.data() as Record<string, unknown>;
          rows.push({
            id: d.id,
            name: String(data.name ?? "List"),
            order: typeof data.order === "number" ? data.order : 0,
          });
        });
        setListRows(rows);
      })
    );

    unsubs.push(
      onSnapshot(todoItemsCol, (snap) => {
        const next: ProjectTodoItem[] = [];
        snap.forEach((d) => next.push(projectTodoItemFromFirestore(d.id, d.data() as Record<string, unknown>)));
        setItems(next);
      })
    );

    unsubs.push(
      onSnapshot(query(boardThreadsCol, orderBy("createdAt", "desc")), (snap) => {
        const next: ProjectBoardThread[] = [];
        snap.forEach((d) => next.push(mapThread(d.id, d.data() as Record<string, unknown>)));
        setThreads(next);
      })
    );

    unsubs.push(
      onSnapshot(query(filesCol, orderBy("uploadedAt", "desc")), (snap) => {
        const next: ProjectFileMeta[] = [];
        snap.forEach((d) => next.push(mapFile(d.id, d.data() as Record<string, unknown>)));
        setFiles(next);
      })
    );

    unsubs.push(
      onSnapshot(query(scheduleEventsCol, orderBy("eventDate", "asc")), (snap) => {
        const next: ProjectScheduleEvent[] = [];
        snap.forEach((d) => next.push(mapScheduleEvent(d.id, d.data() as Record<string, unknown>)));
        setScheduleEvents(next);
      })
    );

    setReady(true);
    return () => unsubs.forEach((u) => u());
  }, [db, workspaceId, projectId]);

  useEffect(() => {
    if (!db || !workspaceId || !projectId || !activeThreadId) {
      setThreadComments([]);
      return;
    }
    const threadRef = doc(
      db,
      "workspaces",
      workspaceId,
      "projects",
      projectId,
      "boardThreads",
      activeThreadId
    );
    const q = query(collection(threadRef, "comments"), orderBy("createdAt", "asc"));
    return onSnapshot(q, (snap) => {
      const next: ProjectBoardComment[] = [];
      snap.forEach((d) => {
        const data = d.data() as Record<string, unknown>;
        next.push({
          id: d.id,
          userId: String(data.userId ?? ""),
          content: String(data.content ?? ""),
          createdAt: toIso(data.createdAt),
        });
      });
      setThreadComments(next);
    });
  }, [db, workspaceId, projectId, activeThreadId]);

  const todoLists: ProjectTodoList[] = useMemo(() => {
    return listRows.map((row) => ({
      id: row.id,
      name: row.name,
      order: row.order,
      tasks: items
        .filter((t) => t.listId === row.id)
        .sort((a, b) => a.title.localeCompare(b.title)),
    }));
  }, [listRows, items]);

  const createTodoList = useCallback(
    async (name: string) => {
      if (!db || !workspaceId || !projectId || !user) return;
      const order = Date.now();
      await addDoc(collection(db, "workspaces", workspaceId, "projects", projectId, "todoLists"), {
        name: name.trim(),
        order,
        createdAt: serverTimestamp(),
      });
    },
    [db, workspaceId, projectId, user]
  );

  const createTodoItem = useCallback(
    async (listId: string, title: string, assignees: string[] = [], dueDate?: string) => {
      if (!db || !workspaceId || !projectId || !user) return;
      await addDoc(collection(db, "workspaces", workspaceId, "projects", projectId, "todoItems"), {
        listId,
        title: title.trim(),
        description: "",
        completed: false,
        assignees: normalizeAssignees(assignees),
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        comments: [],
        createdAt: serverTimestamp(),
      });
    },
    [db, workspaceId, projectId, user]
  );

  const toggleTodoItem = useCallback(
    async (itemId: string, completed: boolean) => {
      if (!db || !workspaceId || !projectId) return;
      await updateDoc(
        doc(db, "workspaces", workspaceId, "projects", projectId, "todoItems", itemId),
        { completed }
      );
    },
    [db, workspaceId, projectId]
  );

  const addTodoItemComment = useCallback(
    async (itemId: string, content: string) => {
      if (!db || !workspaceId || !projectId || !user) return;
      const ref = doc(db, "workspaces", workspaceId, "projects", projectId, "todoItems", itemId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
      const prev = projectTodoItemFromFirestore(snap.id, snap.data() as Record<string, unknown>);
      const newComment: Comment = {
        id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
        userId: user.uid,
        content: content.trim(),
        createdAt: new Date().toISOString(),
      };
      await updateDoc(ref, { comments: [...prev.comments, newComment] });
    },
    [db, workspaceId, projectId, user]
  );

  const deleteTodoItem = useCallback(
    async (itemId: string) => {
      if (!db || !workspaceId || !projectId) return;
      await deleteDoc(doc(db, "workspaces", workspaceId, "projects", projectId, "todoItems", itemId));
    },
    [db, workspaceId, projectId]
  );

  const updateTodoItem = useCallback(
    async (itemId: string, updates: { assignees?: string[]; dueDate?: string | null }) => {
      if (!db || !workspaceId || !projectId) return;
      const payload: Record<string, unknown> = {};
      if ("assignees" in updates) payload.assignees = normalizeAssignees(updates.assignees ?? []);
      if ("dueDate" in updates) payload.dueDate = updates.dueDate ?? null;
      if (Object.keys(payload).length === 0) return;
      await updateDoc(
        doc(db, "workspaces", workspaceId, "projects", projectId, "todoItems", itemId),
        payload as DocumentData
      );
    },
    [db, workspaceId, projectId]
  );

  const deleteTodoList = useCallback(
    async (listId: string) => {
      if (!db || !workspaceId || !projectId) return;
      const batch = writeBatch(db);
      const itemsSnap = await getDocs(
        query(
          collection(db, "workspaces", workspaceId, "projects", projectId, "todoItems"),
          where("listId", "==", listId)
        )
      );
      itemsSnap.forEach((itemDoc) => batch.delete(itemDoc.ref));
      batch.delete(doc(db, "workspaces", workspaceId, "projects", projectId, "todoLists", listId));
      await batch.commit();
    },
    [db, workspaceId, projectId]
  );

  const createBoardThread = useCallback(
    async (title: string, content: string) => {
      if (!db || !workspaceId || !projectId || !user) return;
      await addDoc(collection(db, "workspaces", workspaceId, "projects", projectId, "boardThreads"), {
        title: title.trim(),
        content: content.trim(),
        userId: user.uid,
        commentCount: 0,
        createdAt: serverTimestamp(),
      });
    },
    [db, workspaceId, projectId, user]
  );

  const addBoardThreadComment = useCallback(
    async (threadId: string, content: string) => {
      if (!db || !workspaceId || !projectId || !user) return;
      const threadRef = doc(db, "workspaces", workspaceId, "projects", projectId, "boardThreads", threadId);
      const cref = doc(collection(threadRef, "comments"));
      const batch = writeBatch(db);
      batch.set(cref, {
        userId: user.uid,
        content: content.trim(),
        createdAt: serverTimestamp(),
      });
      batch.update(threadRef, { commentCount: increment(1) });
      await batch.commit();
    },
    [db, workspaceId, projectId, user]
  );

  const uploadFiles = useCallback(
    async (fileList: FileList | File[]) => {
      if (!db || !storage || !workspaceId || !projectId || !user) return;
      const arr = Array.from(fileList);
      for (const file of arr) {
        const safeName = file.name.replace(/[^\w.\-()+ ]/g, "_");
        const objectPath = `workspaces/${workspaceId}/projects/${projectId}/${crypto.randomUUID()}_${safeName}`;
        const storageRef = ref(storage, objectPath);
        await uploadBytes(storageRef, file, { contentType: file.type || "application/octet-stream" });
        const downloadURL = await getDownloadURL(storageRef);
        await addDoc(collection(db, "workspaces", workspaceId, "projects", projectId, "files"), {
          name: file.name,
          storagePath: objectPath,
          downloadURL,
          contentType: file.type || "application/octet-stream",
          size: file.size,
          uploadedBy: user.uid,
          uploadedAt: serverTimestamp(),
        });
      }
    },
    [db, storage, workspaceId, projectId, user]
  );

  const deleteProjectFile = useCallback(
    async (file: ProjectFileMeta) => {
      if (!db || !storage || !workspaceId || !projectId) return;
      try {
        await deleteObject(ref(storage, file.storagePath));
      } catch {
        /* file may already be gone */
      }
      await deleteDoc(doc(db, "workspaces", workspaceId, "projects", projectId, "files", file.id));
    },
    [db, storage, workspaceId, projectId]
  );

  const createScheduleEvent = useCallback(
    async (title: string, eventDate: string, notes: string): Promise<string | null> => {
      if (!db || !workspaceId || !projectId || !user) return null;
      const trimmedTitle = title.trim();
      if (!trimmedTitle || !eventDate) return null;
      const ref = await addDoc(collection(db, "workspaces", workspaceId, "projects", projectId, "scheduleEvents"), {
        title: trimmedTitle,
        notes: notes.trim(),
        eventDate: new Date(`${eventDate}T09:00:00`).toISOString(),
        createdBy: user.uid,
        reminderSent: false,
        createdAt: serverTimestamp(),
      });
      return ref.id;
    },
    [db, workspaceId, projectId, user]
  );

  const deleteScheduleEvent = useCallback(
    async (eventId: string) => {
      if (!db || !workspaceId || !projectId) return;
      await deleteDoc(doc(db, "workspaces", workspaceId, "projects", projectId, "scheduleEvents", eventId));
    },
    [db, workspaceId, projectId]
  );

  return {
    ready: ready && basePathOk,
    todoLists,
    threads,
    files,
    scheduleEvents,
    threadComments,
    createTodoList,
    createTodoItem,
    toggleTodoItem,
    deleteTodoItem,
    updateTodoItem,
    deleteTodoList,
    addTodoItemComment,
    createBoardThread,
    addBoardThreadComment,
    uploadFiles,
    deleteProjectFile,
    createScheduleEvent,
    deleteScheduleEvent,
  };
}
