"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot } from "firebase/firestore";
import { getFirebaseDb } from "../lib/firebase";
import {
  isAssignedToAnyIdentity,
  projectTodoItemFromFirestore,
} from "../lib/firestoreMappers";
import type { ProjectTodoItem } from "../types";

export type AssignedProjectTodoRow = { projectId: string; item: ProjectTodoItem };

function sortRows(rows: AssignedProjectTodoRow[]): AssignedProjectTodoRow[] {
  return [...rows].sort((a, b) => a.item.title.localeCompare(b.item.title));
}

/**
 * Live project To-Do items (todoItems subcollection) assigned to the current user.
 * Listens per project (same paths as Project Detail) — compatible with existing Firestore rules.
 */
export function useMyAssignedProjectTodoItems(
  workspaceId: string | null,
  identityIds: string[],
  projectIds: string[] = []
) {
  const db = getFirebaseDb();
  const identityKey = useMemo(
    () => [...new Set(identityIds.map((id) => id.trim()).filter(Boolean))].sort().join("\u0001"),
    [identityIds]
  );
  const projectIdsKey = useMemo(
    () => [...new Set(projectIds.filter(Boolean))].sort().join("\u0001"),
    [projectIds]
  );
  const ids = useMemo(
    () => (projectIdsKey.length > 0 ? projectIdsKey.split("\u0001") : []),
    [projectIdsKey]
  );

  const [rowsByProject, setRowsByProject] = useState<Record<string, AssignedProjectTodoRow[]>>({});

  useEffect(() => {
    if (!db || !workspaceId || identityKey.length === 0 || ids.length === 0) {
      setRowsByProject({});
      return;
    }

    let cancelled = false;
    const uidList = identityKey.split("\u0001");
    const matchesUser = (assignees: string[]) => isAssignedToAnyIdentity(assignees, uidList);

    setRowsByProject({});

    const unsubs = ids.map((projectId) => {
      const col = collection(db, "workspaces", workspaceId, "projects", projectId, "todoItems");
      return onSnapshot(
        col,
        (snap) => {
          if (cancelled) return;

          const rows: AssignedProjectTodoRow[] = [];
          snap.forEach((d) => {
            const item = projectTodoItemFromFirestore(d.id, d.data() as Record<string, unknown>);
            if (matchesUser(item.assignees)) {
              rows.push({ projectId, item });
            }
          });
          setRowsByProject((prev) => ({ ...prev, [projectId]: rows }));
        },
        (err) => console.error(`[useMyAssignedProjectTodoItems] ${projectId}:`, err)
      );
    });

    return () => {
      cancelled = true;
      unsubs.forEach((u) => u());
    };
  }, [db, workspaceId, identityKey, projectIdsKey, ids]);

  const assignedTodoRows = useMemo(() => {
    const merged = ids.flatMap((projectId) => rowsByProject[projectId] ?? []);
    return sortRows(merged);
  }, [ids, rowsByProject]);

  const deleteProjectTodoItem = useCallback(
    async (projectId: string, itemId: string) => {
      if (!db || !workspaceId) return;
      await deleteDoc(doc(db, "workspaces", workspaceId, "projects", projectId, "todoItems", itemId));
    },
    [db, workspaceId]
  );

  return { assignedTodoRows, deleteProjectTodoItem };
}
