import React, { useEffect, useMemo, useState } from "react";
import { useAppContext } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { useMyAssignedProjectTodoItems } from "../hooks/useMyAssignedProjectTodoItems";
import { CheckSquare, Clock, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { collectUserIdentityIds, isUserAmongAssignees } from "../lib/firestoreMappers";
import type { ProjectTodoItem, Task, TaskStatus } from "../types";

type KanbanRow = { kind: "kanban"; task: Task };
type TodoRow = { kind: "todo"; projectId: string; item: ProjectTodoItem };
type MyTaskRow = KanbanRow | TodoRow;

import { todoItemStatus } from "../lib/firestoreMappers";

function statusDotClass(status: TaskStatus): string {
  switch (status) {
    case "todo":
      return "bg-blue-500";
    case "in-progress":
      return "bg-amber-500";
    case "review":
      return "bg-violet-500";
    case "done":
      return "bg-emerald-500";
    default:
      return "bg-slate-400";
  }
}

function priorityTextClass(priority: string): string {
  switch (priority) {
    case "urgent":
      return "text-rose-600";
    case "high":
      return "text-amber-600";
    default:
      return "text-gray-400";
  }
}

export type MyTasksRowFocus =
  | { kind: "kanban"; taskId: string }
  | { kind: "todo"; projectId: string; itemId: string };

export const MyTasks: React.FC<{
  rowFocus?: MyTasksRowFocus | null;
  onRowFocusConsumed?: () => void;
  /** Ensures the project you just left is still queried (before the projects list updates). */
  extraProjectIds?: string[];
}> = ({ rowFocus = null, onRowFocusConsumed, extraProjectIds = [] }) => {
  const { currentUser, tasks, projects, users, deleteTask } = useAppContext();
  const { user } = useAuth();
  const { workspaceId } = useWorkspace();
  const projectIds = useMemo(() => {
    const merged = new Set(projects.map((p) => p.id));
    for (const id of extraProjectIds) {
      if (id) merged.add(id);
    }
    return Array.from(merged);
  }, [projects, extraProjectIds]);
  const identityIds = useMemo(
    () => collectUserIdentityIds(currentUser.id, user?.uid ?? null, users, currentUser.email),
    [currentUser.id, currentUser.email, user?.uid, users]
  );
  const { assignedTodoRows, deleteProjectTodoItem } = useMyAssignedProjectTodoItems(
    workspaceId,
    identityIds,
    projectIds
  );
  const [filter, setFilter] = useState<"all" | TaskStatus>("all");

  const myKanbanTasks = useMemo(
    () => tasks.filter((t) => identityIds.some((id) => isUserAmongAssignees(t.assignees, id))),
    [tasks, identityIds]
  );

  const myTaskRows: MyTaskRow[] = useMemo(() => {
    const kanban: MyTaskRow[] = myKanbanTasks.map((task) => ({ kind: "kanban", task }));
    const todo: MyTaskRow[] = assignedTodoRows.map(({ projectId, item }) => ({
      kind: "todo",
      projectId,
      item,
    }));
    return [...kanban, ...todo];
  }, [myKanbanTasks, assignedTodoRows]);

  const filteredRows = useMemo(() => {
    if (filter === "all") return myTaskRows;
    return myTaskRows.filter((row) => {
      if (row.kind === "kanban") return row.task.status === filter;
      const st = todoItemStatus(row.item);
      if (filter === "done") return st === "done";
      if (filter === "todo" || filter === "in-progress" || filter === "review") {
        return st === "todo";
      }
      return false;
    });
  }, [myTaskRows, filter]);

  useEffect(() => {
    if (!rowFocus) return;
    setFilter("all");
    const id =
      rowFocus.kind === "kanban"
        ? `my-task-k-${rowFocus.taskId}`
        : `my-task-t-${rowFocus.projectId}-${rowFocus.itemId}`;
    let cancelled = false;
    const t = window.setTimeout(() => {
      if (cancelled) return;
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
      onRowFocusConsumed?.();
    }, 50);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [rowFocus, onRowFocusConsumed]);

  const handleDeleteRow = async (row: MyTaskRow) => {
    const confirmed = window.confirm("Delete this task?");
    if (!confirmed) return;
    if (row.kind === "kanban") await deleteTask(row.task.id);
    else await deleteProjectTodoItem(row.projectId, row.item.id);
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">My Tasks</h1>
        <p className="text-gray-500 mt-1 font-medium">
          {myKanbanTasks.length} board task{myKanbanTasks.length === 1 ? "" : "s"} ·{" "}
          {assignedTodoRows.length} list task{assignedTodoRows.length === 1 ? "" : "s"} assigned to you.
        </p>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {(["all", "todo", "in-progress", "review", "done"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold capitalize whitespace-nowrap transition-colors ${
              filter === f ? "bg-blue-600 text-white shadow-sm" : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
            }`}
          >
            {f === "all" ? "All Tasks" : f.replace("-", " ")}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filteredRows.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-gray-100 shadow-sm">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckSquare size={24} className="text-gray-300" />
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-1">No tasks found</h3>
            <p className="text-gray-500">You're all caught up! Great job.</p>
          </div>
        ) : (
          filteredRows.map((row, index) => {
            if (row.kind === "kanban") {
              const { task } = row;
              const project = projects.find((p) => p.id === task.projectId);
              return (
                <div
                  key={`k-${task.id}`}
                  id={`my-task-k-${task.id}`}
                  className="bg-white rounded-2xl p-5 sm:p-6 border border-gray-100 shadow-sm hover:shadow transition-shadow flex flex-col sm:flex-row gap-4 sm:items-center"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 text-[11px] uppercase tracking-wider font-semibold text-gray-400">
                      <span className="text-gray-600">{project?.name || "Unknown Project"}</span>
                      <span className="text-gray-300">·</span>
                      <span>Board</span>
                      <span className="text-gray-300">·</span>
                      <span className={priorityTextClass(task.priority)}>{task.priority}</span>
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-1 leading-snug">{task.title}</h3>
                    <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-gray-400">
                      <span className="flex items-center gap-1.5">
                        <Clock size={14} className="stroke-[3px]" /> {format(new Date(task.dueDate), "MMM d")}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto mt-2 sm:mt-0 pt-4 sm:pt-0 border-t sm:border-0 border-gray-100">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold capitalize text-gray-700 border border-gray-200 bg-white">
                      <span className={`h-1.5 w-1.5 rounded-full ${statusDotClass(task.status)}`} />
                      {task.status.replace("-", " ")}
                    </div>
                    <button
                      onClick={() => void handleDeleteRow(row)}
                      className="h-8 w-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-colors bg-white shrink-0"
                      aria-label={`Delete task ${task.title}`}
                      title="Delete task"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            }

            const { projectId, item } = row;
            const project = projects.find((p) => p.id === projectId);
            const status = todoItemStatus(item);
            return (
              <div
                key={`t-${projectId}-${item.id}-${index}`}
                id={`my-task-t-${projectId}-${item.id}`}
                className="bg-white rounded-2xl p-5 sm:p-6 border border-gray-100 shadow-sm hover:shadow transition-shadow flex flex-col sm:flex-row gap-4 sm:items-center"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2 text-[11px] uppercase tracking-wider font-semibold text-gray-400">
                    <span className="text-gray-600">{project?.name || "Unknown Project"}</span>
                    <span className="text-gray-300">·</span>
                    <span>List</span>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-1 leading-snug">{item.title}</h3>
                  <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-gray-400">
                    <span className="flex items-center gap-1.5">
                      <Clock size={14} className="stroke-[3px]" />
                      {item.dueDate ? format(new Date(item.dueDate), "MMM d") : "No due date"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto mt-2 sm:mt-0 pt-4 sm:pt-0 border-t sm:border-0 border-gray-100">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold capitalize text-gray-700 border border-gray-200 bg-white">
                    <span className={`h-1.5 w-1.5 rounded-full ${statusDotClass(status)}`} />
                    {status.replace("-", " ")}
                  </div>
                  <button
                    onClick={() => void handleDeleteRow(row)}
                    className="h-8 w-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-colors bg-white shrink-0"
                    aria-label={`Delete task ${item.title}`}
                    title="Delete task"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
