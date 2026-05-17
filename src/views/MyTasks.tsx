import React, { useEffect, useMemo, useState } from "react";
import { useAppContext } from "../context/AppContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { useMyAssignedProjectTodoItems } from "../hooks/useMyAssignedProjectTodoItems";
import { CheckSquare, Clock, Trash2 } from "lucide-react";
import { format } from "date-fns";
import type { ProjectTodoItem, Task, TaskStatus } from "../types";

type KanbanRow = { kind: "kanban"; task: Task };
type TodoRow = { kind: "todo"; projectId: string; item: ProjectTodoItem };
type MyTaskRow = KanbanRow | TodoRow;

function todoItemAsStatus(item: ProjectTodoItem): TaskStatus {
  return item.completed ? "done" : "todo";
}

export type MyTasksRowFocus =
  | { kind: "kanban"; taskId: string }
  | { kind: "todo"; projectId: string; itemId: string };

export const MyTasks: React.FC<{
  rowFocus?: MyTasksRowFocus | null;
  onRowFocusConsumed?: () => void;
}> = ({ rowFocus = null, onRowFocusConsumed }) => {
  const { currentUser, tasks, projects, deleteTask } = useAppContext();
  const { workspaceId } = useWorkspace();
  const projectIds = useMemo(() => projects.map((p) => p.id), [projects]);
  const { assignedTodoRows, deleteProjectTodoItem } = useMyAssignedProjectTodoItems(
    workspaceId,
    currentUser.id,
    projectIds
  );
  const [filter, setFilter] = useState<"all" | TaskStatus>("all");

  const myKanbanTasks = useMemo(
    () => tasks.filter((t) => t.assignees.includes(currentUser.id)),
    [tasks, currentUser.id]
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
      const st = todoItemAsStatus(row.item);
      if (filter === "done") return st === "done";
      if (filter === "todo") return st === "todo";
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
        <h1 className="text-3xl font-black text-indigo-900 tracking-tight">My Tasks</h1>
        <p className="text-slate-500 mt-1 font-medium">
          Kanban tasks and project list items assigned to you across all projects.
        </p>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {(["all", "todo", "in-progress", "review", "done"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-bold capitalize whitespace-nowrap transition-colors ${
              filter === f ? "bg-indigo-600 text-white shadow-md shadow-indigo-200" : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
            }`}
          >
            {f === "all" ? "All Tasks" : f.replace("-", " ")}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filteredRows.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-sm">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckSquare size={24} className="text-slate-300" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-1">No tasks found</h3>
            <p className="text-slate-500">You're all caught up! Great job.</p>
          </div>
        ) : (
          filteredRows.map((row) => {
            if (row.kind === "kanban") {
              const { task } = row;
              const project = projects.find((p) => p.id === task.projectId);
              return (
                <div
                  key={`k-${task.id}`}
                  id={`my-task-k-${task.id}`}
                  className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow flex flex-col sm:flex-row gap-4 sm:items-center"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-[10px] uppercase tracking-widest font-black text-indigo-500 bg-indigo-50 px-2 flex py-1 rounded-md">
                        {project?.name || "Unknown Project"}
                      </span>
                      <span className="text-[10px] uppercase tracking-widest font-black text-violet-600 bg-violet-50 px-2 py-1 rounded-md">
                        Board
                      </span>
                      <span
                        className={`text-[10px] uppercase flex tracking-widest font-black px-2 py-1 rounded-md ${
                          task.priority === "urgent"
                            ? "bg-rose-50 text-rose-600"
                            : task.priority === "high"
                              ? "bg-amber-50 text-amber-600"
                              : "bg-slate-50 text-slate-500"
                        }`}
                      >
                        {task.priority}
                      </span>
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-800 mb-1 leading-snug">{task.title}</h3>
                    <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <Clock size={14} className="stroke-[3px]" /> {format(new Date(task.dueDate), "MMM d")}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto mt-2 sm:mt-0 pt-4 sm:pt-0 border-t sm:border-0 border-slate-100">
                    <div className="px-3 py-1.5 rounded-lg text-xs font-bold capitalize bg-slate-50 border border-slate-100 text-slate-600">
                      {task.status.replace("-", " ")}
                    </div>
                    <button
                      onClick={() => void handleDeleteRow(row)}
                      className="h-8 w-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-colors bg-white shrink-0"
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
            const status = todoItemAsStatus(item);
            return (
              <div
                key={`t-${projectId}-${item.id}`}
                id={`my-task-t-${projectId}-${item.id}`}
                className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow flex flex-col sm:flex-row gap-4 sm:items-center"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-[10px] uppercase tracking-widest font-black text-indigo-500 bg-indigo-50 px-2 flex py-1 rounded-md">
                      {project?.name || "Unknown Project"}
                    </span>
                    <span className="text-[10px] uppercase tracking-widest font-black text-sky-700 bg-sky-50 px-2 py-1 rounded-md">
                      List
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-800 mb-1 leading-snug">{item.title}</h3>
                  <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <Clock size={14} className="stroke-[3px]" />
                      {item.dueDate ? format(new Date(item.dueDate), "MMM d") : "No due date"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto mt-2 sm:mt-0 pt-4 sm:pt-0 border-t sm:border-0 border-slate-100">
                  <div className="px-3 py-1.5 rounded-lg text-xs font-bold capitalize bg-slate-50 border border-slate-100 text-slate-600">
                    {status.replace("-", " ")}
                  </div>
                  <button
                    onClick={() => void handleDeleteRow(row)}
                    className="h-8 w-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-colors bg-white shrink-0"
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
