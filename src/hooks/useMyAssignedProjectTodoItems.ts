"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot } from "firebase/firestore";
import { getFirebaseDb } from "../lib/firebase";
import { projectTodoItemFromFirestore } from "../lib/firestoreMappers";
import type { ProjectTodoItem } from "../types";

export type AssignedProjectTodoRow = { projectId: string; item: ProjectTodoItem };

/**
 * Live project To-Do items (todoItems subcollection) assigned to userId, across all given projects.
 * Workspace Kanban tasks live in a separate collection; this hook covers the lists inside Project Detail.
 */
export function useMyAssignedProjectTodoItems(
  workspaceId: string | null,
  userId: string,
  projectIds: string[]
) {
  const db = getFirebaseDb();
  const projectIdsKey = useMemo(() => JSON.stringify([...projectIds].sort()), [projectIds]);

  const [assignedTodoRows, setAssignedTodoRows] = useState<AssignedProjectTodoRow[]>([]);

  useEffect(() => {
    if (!db || !workspaceId || !userId) {
      setAssignedTodoRows([]);
      return;
    }

    let ids: string[] = [];
    try {
      ids = JSON.parse(projectIdsKey) as string[];
    } catch {
      ids = [];
    }
    if (ids.length === 0) {
      setAssignedTodoRows([]);
      return;
    }

    const merged = new Map<string, AssignedProjectTodoRow>();

    const publish = () => {
      setAssignedTodoRows(Array.from(merged.values()).filter((r) => r.item.assignees.includes(userId)));
    };

    const unsubs = ids.map((pid) => {
      const col = collection(db, "workspaces", workspaceId, "projects", pid, "todoItems");
      return onSnapshot(col, (snap) => {
        for (const [k, v] of merged) {
          if (v.projectId === pid) merged.delete(k);
        }
        snap.forEach((d) => {
          const item = projectTodoItemFromFirestore(d.id, d.data() as Record<string, unknown>);
          merged.set(`${pid}:${item.id}`, { projectId: pid, item });
        });
        publish();
      });
    });

    return () => unsubs.forEach((u) => u());
  }, [db, workspaceId, userId, projectIdsKey]);

  const deleteProjectTodoItem = useCallback(
    async (projectId: string, itemId: string) => {
      if (!db || !workspaceId) return;
      await deleteDoc(doc(db, "workspaces", workspaceId, "projects", projectId, "todoItems", itemId));
    },
    [db, workspaceId]
  );

  return { assignedTodoRows, deleteProjectTodoItem };
}
