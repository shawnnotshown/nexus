"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { getFirebaseDb } from "../lib/firebase";
import type { ProjectScheduleEvent } from "../types";

export type ProjectScheduleEventRow = {
  projectId: string;
  event: ProjectScheduleEvent;
};

function mapScheduleEvent(id: string, data: Record<string, unknown>): ProjectScheduleEvent {
  const toIso = (value: unknown): string => {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "object" && value !== null && "toDate" in value) {
      const timestamp = value as { toDate: () => Date };
      return timestamp.toDate().toISOString();
    }
    if (typeof value === "string") return value;
    return new Date().toISOString();
  };

  return {
    id,
    title: String(data.title ?? ""),
    notes: String(data.notes ?? ""),
    eventDate: toIso(data.eventDate),
    createdBy: String(data.createdBy ?? ""),
  };
}

export function useProjectScheduleEvents(workspaceId: string | null, projectIds: string[]) {
  const db = getFirebaseDb();
  const projectIdsKey = useMemo(() => JSON.stringify([...projectIds].sort()), [projectIds]);
  const [scheduleEventRows, setScheduleEventRows] = useState<ProjectScheduleEventRow[]>([]);

  useEffect(() => {
    if (!db || !workspaceId) {
      setScheduleEventRows([]);
      return;
    }

    let ids: string[] = [];
    try {
      ids = JSON.parse(projectIdsKey) as string[];
    } catch {
      ids = [];
    }

    if (ids.length === 0) {
      setScheduleEventRows([]);
      return;
    }

    const merged = new Map<string, ProjectScheduleEventRow>();
    const publish = () => {
      setScheduleEventRows(
        Array.from(merged.values()).sort(
          (a, b) => new Date(a.event.eventDate).getTime() - new Date(b.event.eventDate).getTime()
        )
      );
    };

    const unsubs = ids.map((projectId) => {
      const col = collection(db, "workspaces", workspaceId, "projects", projectId, "scheduleEvents");
      return onSnapshot(col, (snap) => {
        for (const [key, value] of merged) {
          if (value.projectId === projectId) merged.delete(key);
        }
        snap.forEach((d) => {
          const event = mapScheduleEvent(d.id, d.data() as Record<string, unknown>);
          merged.set(`${projectId}:${event.id}`, { projectId, event });
        });
        publish();
      });
    });

    return () => unsubs.forEach((unsubscribe) => unsubscribe());
  }, [db, workspaceId, projectIdsKey]);

  return { scheduleEventRows };
}
