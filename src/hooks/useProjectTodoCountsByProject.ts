"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { getFirebaseDb } from "../lib/firebase";

export type ProjectTodoCounts = { total: number; completed: number };

/**
 * Live counts from each project's `todoItems` subcollection (for aggregate progress on list views).
 */
export function useProjectTodoCountsByProject(workspaceId: string | null, projectIds: string[]) {
  const db = getFirebaseDb();
  const sortedKey = useMemo(() => [...new Set(projectIds)].filter(Boolean).sort().join(","), [projectIds]);
  const ids = useMemo(() => (sortedKey.length > 0 ? sortedKey.split(",") : []), [sortedKey]);

  const [counts, setCounts] = useState<Record<string, ProjectTodoCounts>>({});

  useEffect(() => {
    if (!db || !workspaceId) {
      setCounts({});
      return;
    }
    if (ids.length === 0) {
      setCounts({});
      return;
    }

    setCounts((prev) => {
      const next: Record<string, ProjectTodoCounts> = {};
      for (const id of ids) {
        if (prev[id]) next[id] = prev[id];
      }
      return next;
    });

    const unsubs = ids.map((projectId) =>
      onSnapshot(
        collection(db, "workspaces", workspaceId, "projects", projectId, "todoItems"),
        (snap) => {
          let total = 0;
          let completed = 0;
          snap.forEach((d) => {
            total++;
            const data = d.data() as { completed?: boolean };
            if (data.completed) completed++;
          });
          setCounts((prev) => ({ ...prev, [projectId]: { total, completed } }));
        },
        (err) => console.error(`[useProjectTodoCounts] ${projectId}:`, err)
      )
    );

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [db, workspaceId, ids]);

  return counts;
}
