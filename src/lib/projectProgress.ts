import type { ProjectTodoList, Task } from "../types";
import { todoItemStatus } from "./firestoreMappers";

export function percentDone(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((done / total) * 100));
}

export function kanbanProgressStats(tasks: Pick<Task, "status">[]): { done: number; total: number } {
  return {
    total: tasks.length,
    done: tasks.filter((t) => t.status === "done").length,
  };
}

export function todoListsProgressStats(lists: ProjectTodoList[]): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const list of lists) {
    for (const t of list.tasks) {
      total++;
      if (todoItemStatus(t) === "done" || t.completed) done++;
    }
  }
  return { done, total };
}

/** Kanban cards + checklist items; if nothing exists, falls back to stored project.progress. */
export function combinedWorkProgressPercent(
  kanban: { done: number; total: number },
  todos: { done: number; total: number },
  storedProgressFallback: number
): number {
  const total = kanban.total + todos.total;
  if (total <= 0) {
    const s = Math.round(storedProgressFallback);
    return Math.min(100, Math.max(0, Number.isFinite(s) ? s : 0));
  }
  return percentDone(kanban.done + todos.done, total);
}
