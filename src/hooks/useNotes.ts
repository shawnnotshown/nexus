"use client";

import { useCallback, useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type DocumentData,
} from "firebase/firestore";
import { getFirebaseDb } from "../lib/firebase";
import type { Note } from "../types";

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const timestamp = value as { toDate: () => Date };
    return timestamp.toDate().toISOString();
  }
  if (typeof value === "string") return value;
  return new Date().toISOString();
}

function mapNote(id: string, data: Record<string, unknown>): Note {
  return {
    id,
    title: String(data.title ?? ""),
    content: String(data.content ?? ""),
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
  };
}

const EMPTY_DOC_CONTENT = JSON.stringify({
  type: "doc",
  content: [{ type: "paragraph" }],
});

export function useNotes(userId: string | null | undefined) {
  const db = getFirebaseDb();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db || !userId) {
      setNotes([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const notesRef = collection(db, "users", userId, "notes");
    const notesQuery = query(notesRef, orderBy("updatedAt", "desc"));

    const unsubscribe = onSnapshot(
      notesQuery,
      (snapshot) => {
        const next = snapshot.docs.map((d) => mapNote(d.id, d.data() as Record<string, unknown>));
        setNotes(next);
        setLoading(false);
      },
      () => {
        setNotes([]);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [db, userId]);

  const createNote = useCallback(async (): Promise<string | null> => {
    if (!db || !userId) return null;

    const ref = await addDoc(collection(db, "users", userId, "notes"), {
      title: "Untitled",
      content: EMPTY_DOC_CONTENT,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return ref.id;
  }, [db, userId]);

  const updateNote = useCallback(
    async (noteId: string, updates: Partial<Pick<Note, "title" | "content">>) => {
      if (!db || !userId) return;

      const payload: DocumentData = {
        updatedAt: serverTimestamp(),
      };

      if (updates.title !== undefined) payload.title = updates.title;
      if (updates.content !== undefined) payload.content = updates.content;

      await updateDoc(doc(db, "users", userId, "notes", noteId), payload);
    },
    [db, userId]
  );

  const deleteNote = useCallback(
    async (noteId: string) => {
      if (!db || !userId) return;
      await deleteDoc(doc(db, "users", userId, "notes", noteId));
    },
    [db, userId]
  );

  return {
    notes,
    loading,
    createNote,
    updateNote,
    deleteNote,
  };
}
