import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAppContext } from "../context/AppContext";
import { format } from "date-fns";
import {
  Clock,
  AlertCircle,
  Plus,
  CheckCircle,
  MessageCircle,
  GripVertical,
  X,
  Pencil,
  Trash2,
} from "lucide-react";
import type { Priority, TaskStatus } from "../types";
import { cn } from "../lib/utils";

const COLUMNS: {
  id: TaskStatus;
  label: string;
  color: string;
  bg: string;
  outlineClass: string;
}[] = [
  {
    id: "todo",
    label: "To Do",
    color: "text-indigo-600",
    bg: "bg-indigo-50",
    outlineClass: "outline-indigo-200",
  },
  {
    id: "in-progress",
    label: "In Progress",
    color: "text-rose-600",
    bg: "bg-rose-50",
    outlineClass: "outline-rose-200",
  },
  {
    id: "review",
    label: "Review",
    color: "text-amber-600",
    bg: "bg-amber-50",
    outlineClass: "outline-amber-200",
  },
  {
    id: "done",
    label: "Done",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    outlineClass: "outline-emerald-200",
  },
];

const PRIORITIES: Priority[] = ["low", "medium", "high", "urgent"];

const DND_TASK_MIME = "application/x-nexus-task-id";

export const KanbanBoard: React.FC<{ projectId: string; teamMemberIds: string[] }> = ({
  projectId,
  teamMemberIds,
}) => {
  const { tasks, updateTaskState, addTask, deleteTask, users, currentUser } = useAppContext();
  const projectTasks = tasks.filter((t) => t.projectId === projectId);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  /** When set, the “new card” modal is open; value is the default board column for the new task */
  const [newCardColumn, setNewCardColumn] = useState<TaskStatus | null>(null);
  const [newCardTitle, setNewCardTitle] = useState("");
  const [newCardDescription, setNewCardDescription] = useState("");
  const [newCardDueDate, setNewCardDueDate] = useState("");
  const [newCardPriority, setNewCardPriority] = useState<Priority>("medium");
  const [newCardAssignees, setNewCardAssignees] = useState<string[]>([]);
  const [newCardAssigneePickerOpen, setNewCardAssigneePickerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editPriority, setEditPriority] = useState<Priority>("medium");
  const [assigneePickerTaskId, setAssigneePickerTaskId] = useState<string | null>(null);
  /** Which task id the edit form was last initialized for (avoid resetting on every tasks[] update) */
  const editorInitializedFor = useRef<string | null>(null);

  const assignableUsers = useMemo(() => {
    const ids = teamMemberIds.length > 0 ? teamMemberIds : users.map((u) => u.id);
    const set = new Set(ids);
    return users.filter((u) => set.has(u.id));
  }, [users, teamMemberIds]);

  useEffect(() => {
    if (!selectedTask) {
      editorInitializedFor.current = null;
      setEditTitle("");
      setEditDescription("");
      setEditDueDate("");
      setEditPriority("medium");
      setAssigneePickerTaskId(null);
      return;
    }
    if (editorInitializedFor.current === selectedTask) return;
    const t = tasks.find((x) => x.id === selectedTask && x.projectId === projectId);
    if (!t) return;
    editorInitializedFor.current = selectedTask;
    setEditTitle(t.title);
    setEditDescription(t.description);
    setEditDueDate(format(new Date(t.dueDate), "yyyy-MM-dd"));
    setEditPriority(t.priority);
  }, [selectedTask, projectId, tasks]);

  const moveTask = (taskId: string, newStatus: TaskStatus) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;
    void updateTaskState(taskId, { status: newStatus });
  };

  const toggleTaskCompletion = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const newStatus = task.status === "done" ? "todo" : "done";
    void updateTaskState(taskId, { status: newStatus, completed: newStatus === "done" });
  };

  const columnMeta = (id: TaskStatus) => COLUMNS.find((c) => c.id === id) ?? COLUMNS[0];

  const persistTaskFields = (taskId: string) => {
    const t = tasks.find((x) => x.id === taskId);
    if (!t) return;
    const title = editTitle.trim();
    if (!title) {
      setEditTitle(t.title);
      return;
    }
    const dueIso = editDueDate
      ? new Date(editDueDate + "T12:00:00").toISOString()
      : t.dueDate;
    const patch: Parameters<typeof updateTaskState>[1] = {};
    if (title !== t.title) patch.title = title;
    if (editDescription !== t.description) patch.description = editDescription;
    if (dueIso !== t.dueDate) patch.dueDate = dueIso;
    if (editPriority !== t.priority) patch.priority = editPriority;
    if (Object.keys(patch).length > 0) void updateTaskState(taskId, patch);
  };

  const addAssignee = (taskId: string, assignees: string[], userId: string) => {
    if (!userId || assignees.includes(userId)) return;
    void updateTaskState(taskId, { assignees: [...assignees, userId] });
    setAssigneePickerTaskId(null);
  };

  const removeAssignee = (taskId: string, assignees: string[], userId: string) => {
    void updateTaskState(taskId, { assignees: assignees.filter((id) => id !== userId) });
  };

  const handleDeleteCard = async (taskId: string, title: string) => {
    const confirmed = window.confirm(`Delete "${title}"? This cannot be undone.`);
    if (!confirmed) return;
    await deleteTask(taskId);
    if (selectedTask === taskId) {
      setSelectedTask(null);
      setAssigneePickerTaskId(null);
      editorInitializedFor.current = null;
    }
  };

  const resetNewCardForm = () => {
    setNewCardTitle("");
    setNewCardDescription("");
    setNewCardDueDate("");
    setNewCardPriority("medium");
    setNewCardAssignees([]);
    setNewCardAssigneePickerOpen(false);
  };

  const initNewCardForm = () => {
    setNewCardTitle("");
    setNewCardDescription("");
    setNewCardDueDate(format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"));
    setNewCardPriority("medium");
    setNewCardAssignees(currentUser.id ? [currentUser.id] : []);
    setNewCardAssigneePickerOpen(false);
  };

  const addNewCardAssignee = (userId: string) => {
    if (!userId || newCardAssignees.includes(userId)) return;
    setNewCardAssignees((prev) => [...prev, userId]);
    setNewCardAssigneePickerOpen(false);
  };

  const removeNewCardAssignee = (userId: string) => {
    setNewCardAssignees((prev) => prev.filter((id) => id !== userId));
  };

  const submitNewCard = async () => {
    if (!newCardColumn) return;
    const title = newCardTitle.trim();
    if (!title || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const dueIso = newCardDueDate
        ? new Date(newCardDueDate + "T12:00:00").toISOString()
        : undefined;
      await addTask({
        projectId,
        title,
        description: newCardDescription.trim(),
        status: newCardColumn,
        dueDate: dueIso,
        priority: newCardPriority,
        assignees: newCardAssignees.length > 0 ? newCardAssignees : undefined,
      });
      resetNewCardForm();
      setNewCardColumn(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const cancelAdd = () => {
    setNewCardColumn(null);
    resetNewCardForm();
  };

  const openNewCardModal = (columnId: TaskStatus) => {
    initNewCardForm();
    setNewCardColumn(columnId);
  };

  useEffect(() => {
    if (!newCardColumn) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setNewCardColumn(null);
        resetNewCardForm();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [newCardColumn]);

  const handleTaskDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData(DND_TASK_MIME, taskId);
    e.dataTransfer.setData("text/plain", taskId);
    e.dataTransfer.effectAllowed = "move";
    setDraggingTaskId(taskId);
  };

  const handleTaskDragEnd = () => {
    setDraggingTaskId(null);
    setDragOverColumn(null);
  };

  const markColumnHover = (e: React.DragEvent, columnId: TaskStatus) => {
    if (!draggingTaskId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverColumn(columnId);
  };

  const dropOnColumn = (e: React.DragEvent, columnId: TaskStatus) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverColumn(null);
    const taskId = e.dataTransfer.getData(DND_TASK_MIME) || e.dataTransfer.getData("text/plain");
    if (!taskId) return;
    moveTask(taskId, columnId);
  };

  const handleColumnDragLeave = (e: React.DragEvent, columnId: TaskStatus) => {
    const next = e.relatedTarget as Node | null;
    if (next && (e.currentTarget as HTMLElement).contains(next)) return;
    setDragOverColumn((prev) => (prev === columnId ? null : prev));
  };

  const toggleEditTask = (taskId: string) => {
    setSelectedTask((prev) => {
      if (prev === taskId) {
        setAssigneePickerTaskId(null);
        return null;
      }
      return taskId;
    });
  };

  return (
    <>
    <div className="flex h-full gap-6 overflow-x-auto pb-6">
      {COLUMNS.map((column) => {
        const columnTasks = projectTasks.filter((t) => t.status === column.id);
        const isDropTarget = dragOverColumn === column.id && draggingTaskId !== null;

        return (
          <div
            key={column.id}
            className={cn(
              "flex-shrink-0 w-80 flex flex-col rounded-[2.5rem] border shadow-sm transition-[box-shadow,border-color,background-color] duration-150",
              isDropTarget
                ? "bg-indigo-50/90 border-indigo-300 ring-2 ring-indigo-400/60 ring-offset-2 ring-offset-slate-50"
                : "bg-slate-50/50 border-indigo-50/50"
            )}
            onDragOver={(e) => markColumnHover(e, column.id)}
            onDrop={(e) => dropOnColumn(e, column.id)}
            onDragLeave={(e) => handleColumnDragLeave(e, column.id)}
          >
            <div className="p-5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className={cn(
                    "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest outline outline-1 outline-offset-2 shrink-0",
                    column.bg,
                    column.color,
                    column.outlineClass
                  )}
                >
                  {column.label}
                </span>
                <span className="text-sm font-bold text-slate-400">{columnTasks.length}</span>
              </div>
              <button
                type="button"
                onClick={() => openNewCardModal(column.id)}
                className="w-8 h-8 flex items-center justify-center bg-white rounded-full text-slate-400 hover:text-indigo-600 shadow-sm hover:shadow-md transition-all shrink-0"
                title="Add card"
                aria-label={`Add card to ${column.label}`}
              >
                <Plus size={16} className="stroke-[3px]" />
              </button>
            </div>

            <div
              className="flex-1 px-4 pb-4 overflow-y-auto space-y-4 min-h-[300px]"
              onDragOver={(e) => markColumnHover(e, column.id)}
              onDrop={(e) => dropOnColumn(e, column.id)}
            >
              {columnTasks.length === 0 && draggingTaskId && (
                <p className="text-center text-xs font-semibold text-indigo-400/90 pt-8 px-4">
                  Drop here to move the card to {column.label}.
                </p>
              )}
              {columnTasks.map((task) => {
                const isUrgent = task.priority === "urgent" || task.priority === "high";
                const assignees = users.filter((u) => task.assignees.includes(u.id));
                const statusCol = columnMeta(task.status);
                const isDragging = draggingTaskId === task.id;
                const isOpen = selectedTask === task.id;
                const showAssigneePicker = assigneePickerTaskId === task.id;

                return (
                  <div
                    key={task.id}
                    className={cn(
                      "group bg-white rounded-3xl border shadow-sm transition-all relative",
                      isDragging ? "opacity-40 scale-[0.98]" : "hover:shadow-lg",
                      isUrgent
                        ? "border-indigo-100 shadow-indigo-100/50 border-l-4 border-l-indigo-500"
                        : "border-slate-100 hover:border-indigo-200"
                    )}
                    onDragOver={(e) => markColumnHover(e, column.id)}
                    onDrop={(e) => dropOnColumn(e, column.id)}
                  >
                    <div className="flex gap-1 p-3 pb-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTaskCompletion(task.id);
                        }}
                        className={cn(
                          "mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors shadow-sm shrink-0 self-start",
                          task.status === "done"
                            ? "bg-emerald-500 border-emerald-500 text-white"
                            : "border-slate-300 hover:border-indigo-400 bg-white text-transparent"
                        )}
                        aria-label={task.status === "done" ? "Mark not done" : "Mark done"}
                      >
                        <CheckCircle size={14} className="stroke-[3px]" />
                      </button>
                      <div
                        draggable
                        onDragStart={(e) => handleTaskDragStart(e, task.id)}
                        onDragEnd={handleTaskDragEnd}
                        className={cn(
                          "min-w-0 flex-1 cursor-grab active:cursor-grabbing rounded-2xl p-3 -m-1 pl-2",
                          task.status === "done" ? "text-slate-400" : ""
                        )}
                      >
                        <div className="flex items-start gap-1.5">
                          <GripVertical
                            className="shrink-0 text-slate-300 group-hover:text-slate-400 mt-0.5"
                            size={16}
                            aria-hidden
                          />
                          <h4
                            className={cn(
                              "font-medium text-sm leading-tight flex-1 select-none text-left",
                              task.status === "done" ? "line-through text-slate-400" : "text-slate-800"
                            )}
                          >
                            {task.title}
                          </h4>
                          <div
                            className={cn(
                              "flex items-center gap-0.5 shrink-0 mt-0.5 transition-opacity",
                              isOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                            )}
                            onMouseDown={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => toggleEditTask(task.id)}
                              className={cn(
                                "p-0.5 rounded-md transition-colors",
                                isOpen
                                  ? "text-indigo-600 bg-indigo-50"
                                  : "text-slate-300 hover:text-indigo-600 hover:bg-indigo-50"
                              )}
                              aria-label={`Edit ${task.title}`}
                              title="Edit card"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteCard(task.id, task.title)}
                              className="p-0.5 rounded-md text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              aria-label={`Delete ${task.title}`}
                              title="Delete card"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {isOpen && (
                      <div
                        className="mx-3 mb-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 space-y-3"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                            Edit card
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              persistTaskFields(task.id);
                              setSelectedTask(null);
                              setAssigneePickerTaskId(null);
                            }}
                            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800"
                          >
                            Done
                          </button>
                        </div>
                        <label className="block">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Title</span>
                          <input
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onBlur={() => persistTaskFields(task.id)}
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                          />
                        </label>
                        <label className="block">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                            Description
                          </span>
                          <textarea
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            onBlur={() => persistTaskFields(task.id)}
                            rows={3}
                            className="mt-1 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                            placeholder="What is this card about?"
                          />
                        </label>
                        <div className="flex flex-col sm:flex-row gap-3">
                          <label className="block flex-1 min-w-0">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                              Due date
                            </span>
                            <input
                              type="date"
                              value={editDueDate}
                              onChange={(e) => setEditDueDate(e.target.value)}
                              onBlur={() => persistTaskFields(task.id)}
                              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                            />
                          </label>
                          <label className="block flex-1 min-w-0">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                              Priority
                            </span>
                            <select
                              value={editPriority}
                              onChange={(e) => {
                                const p = e.target.value as Priority;
                                setEditPriority(p);
                                void updateTaskState(task.id, { priority: p });
                              }}
                              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                            >
                              {PRIORITIES.map((p) => (
                                <option key={p} value={p}>
                                  {p}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                              Assignees
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setAssigneePickerTaskId((prev) => (prev === task.id ? null : task.id))
                              }
                              className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5"
                            >
                              <Plus size={12} className="stroke-[3px]" /> Add
                            </button>
                          </div>
                          {showAssigneePicker && (
                            <div className="mb-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm space-y-1 max-h-40 overflow-y-auto">
                              {assignableUsers.filter((u) => !task.assignees.includes(u.id)).length === 0 ? (
                                <p className="text-xs font-medium text-slate-500 px-2 py-1">
                                  Everyone on the project is already assigned
                                </p>
                              ) : (
                                assignableUsers
                                  .filter((u) => !task.assignees.includes(u.id))
                                  .map((u) => (
                                    <button
                                      key={u.id}
                                      type="button"
                                      onClick={() => addAssignee(task.id, task.assignees, u.id)}
                                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors text-left"
                                    >
                                      {u.avatar ? (
                                        <img
                                          src={u.avatar}
                                          alt=""
                                          className="w-6 h-6 rounded-full border border-slate-200 object-cover shrink-0"
                                        />
                                      ) : (
                                        <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-[10px] font-bold flex items-center justify-center shrink-0">
                                          {(u.name ?? "?").charAt(0).toUpperCase()}
                                        </div>
                                      )}
                                      <span className="text-sm font-semibold text-slate-700 truncate">{u.name}</span>
                                    </button>
                                  ))
                              )}
                            </div>
                          )}
                          <div className="space-y-1.5">
                            {task.assignees.length === 0 ? (
                              <p className="text-xs font-medium text-slate-500 italic px-2 py-2 rounded-xl border border-dashed border-slate-200 bg-white text-center">
                                Unassigned — add people who own this work
                              </p>
                            ) : (
                              task.assignees.map((id) => {
                                const u = assignableUsers.find((pu) => pu.id === id) ?? users.find((x) => x.id === id);
                                if (!u) return null;
                                return (
                                  <div
                                    key={id}
                                    className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-100 group/row"
                                  >
                                    {u.avatar ? (
                                      <img
                                        src={u.avatar}
                                        alt=""
                                        className="w-7 h-7 rounded-full border border-slate-200 object-cover shrink-0"
                                      />
                                    ) : (
                                      <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold flex items-center justify-center shrink-0">
                                        {(u.name ?? "?").charAt(0).toUpperCase()}
                                      </div>
                                    )}
                                    <span className="text-sm font-semibold text-slate-700 flex-1 truncate">
                                      {u.name}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => removeAssignee(task.id, task.assignees, id)}
                                      className="text-slate-300 opacity-0 group-hover/row:opacity-100 hover:text-rose-500 p-1 rounded-lg transition-all"
                                      title={`Remove ${u.name}`}
                                      aria-label={`Remove ${u.name}`}
                                    >
                                      <X size={14} />
                                    </button>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => persistTaskFields(task.id)}
                          className="w-full rounded-xl bg-indigo-600 text-white text-xs font-bold py-2.5 hover:bg-indigo-700 transition-colors"
                        >
                          Save changes
                        </button>
                      </div>
                    )}

                    {isOpen && task.subtasks.length > 0 && (
                      <div className="mx-3 mb-2 text-xs text-slate-500 bg-white rounded-xl border border-slate-100 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Subtasks</p>
                        <div className="space-y-1">
                          {task.subtasks.map((st) => (
                            <div key={st.id} className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={st.completed}
                                readOnly
                                className="rounded text-indigo-600"
                              />
                              <span className={st.completed ? "line-through text-slate-400" : ""}>{st.title}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between px-3 pb-3 pt-1 text-xs text-slate-500">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={cn(
                            "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md",
                            statusCol.bg,
                            statusCol.color
                          )}
                        >
                          {statusCol.label}
                        </span>
                        {isUrgent && (
                          <span className="flex items-center gap-1 text-red-600 bg-red-50 px-1.5 py-0.5 rounded font-medium">
                            <AlertCircle size={12} />
                            Urgent
                          </span>
                        )}
                        <span
                          className={cn(
                            "flex items-center gap-1",
                            new Date(task.dueDate) < new Date() && task.status !== "done"
                              ? "text-red-500 font-bold"
                              : ""
                          )}
                        >
                          <Clock size={14} />
                          {format(new Date(task.dueDate), "MMM d")}
                        </span>
                        {task.comments.length > 0 && (
                          <span className="flex items-center gap-1">
                            <MessageCircle size={14} />
                            {task.comments.length}
                          </span>
                        )}
                      </div>

                      <div className="flex -space-x-1.5 shrink-0">
                        {assignees.map((a, i) =>
                          a.avatar ? (
                            <img
                              key={a.id}
                              src={a.avatar}
                              alt=""
                              className="w-6 h-6 rounded-full border-2 border-white bg-slate-200 object-cover"
                              style={{ zIndex: assignees.length - i }}
                              title={a.name}
                              draggable={false}
                            />
                          ) : (
                            <div
                              key={a.id}
                              className="w-6 h-6 rounded-full border-2 border-white bg-indigo-100 text-indigo-600 text-[10px] font-bold flex items-center justify-center"
                              style={{ zIndex: assignees.length - i }}
                              title={a.name}
                            >
                              {(a.name ?? "?").charAt(0).toUpperCase()}
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>

    {newCardColumn != null && (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-kanban-card-title"
        onClick={() => cancelAdd()}
      >
        <div
          className="bg-white rounded-[2rem] w-full max-w-lg max-h-[min(92vh,42rem)] shadow-2xl border border-indigo-100 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4 p-6 sm:p-8 pb-4 border-b border-slate-100 shrink-0">
            <div className="min-w-0 pr-2">
              <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">Features & updates</p>
              <h2 id="new-kanban-card-title" className="text-xl sm:text-2xl font-black text-indigo-900 tracking-tight">
                New card
              </h2>
              <p className="text-slate-500 text-sm font-medium mt-1">
                Set title, details, due date, priority, and who is working on it.
              </p>
            </div>
            <button
              type="button"
              onClick={() => cancelAdd()}
              className="shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
              aria-label="Close"
            >
              <X size={20} className="stroke-[3px]" />
            </button>
          </div>

          <div className="overflow-y-auto flex-1 min-h-0 px-6 sm:px-8 py-4 space-y-4">
            <label className="block">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Start in column</span>
              <select
                value={newCardColumn}
                onChange={(e) => setNewCardColumn(e.target.value as TaskStatus)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
              >
                {COLUMNS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Title</span>
              <input
                autoFocus
                value={newCardTitle}
                onChange={(e) => setNewCardTitle(e.target.value)}
                placeholder="What needs to be done?"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Details</span>
              <textarea
                value={newCardDescription}
                onChange={(e) => setNewCardDescription(e.target.value)}
                rows={4}
                placeholder="Context, links, acceptance criteria…"
                className="mt-1 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 min-h-[5rem]"
              />
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block min-w-0">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Due date</span>
                <input
                  type="date"
                  value={newCardDueDate}
                  onChange={(e) => setNewCardDueDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
                />
              </label>
              <label className="block min-w-0">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Priority</span>
                <select
                  value={newCardPriority}
                  onChange={(e) => setNewCardPriority(e.target.value as Priority)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Assignees</span>
                <button
                  type="button"
                  onClick={() => setNewCardAssigneePickerOpen((o) => !o)}
                  className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5"
                >
                  <Plus size={12} className="stroke-[3px]" /> Add
                </button>
              </div>
              {newCardAssigneePickerOpen && (
                <div className="mb-2 rounded-xl border border-slate-200 bg-slate-50 p-2 space-y-1 max-h-40 overflow-y-auto">
                  {assignableUsers.filter((u) => !newCardAssignees.includes(u.id)).length === 0 ? (
                    <p className="text-xs font-medium text-slate-500 px-2 py-1">Everyone is selected</p>
                  ) : (
                    assignableUsers
                      .filter((u) => !newCardAssignees.includes(u.id))
                      .map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => addNewCardAssignee(u.id)}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors text-left"
                        >
                          {u.avatar ? (
                            <img
                              src={u.avatar}
                              alt=""
                              className="w-6 h-6 rounded-full border border-slate-200 object-cover shrink-0"
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-[10px] font-bold flex items-center justify-center shrink-0">
                              {(u.name ?? "?").charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="text-sm font-semibold text-slate-700 truncate">{u.name}</span>
                        </button>
                      ))
                  )}
                </div>
              )}
              <div className="flex flex-wrap gap-1.5">
                {newCardAssignees.length === 0 ? (
                  <p className="text-xs font-medium text-slate-500 italic w-full py-3 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50">
                    No assignees — use Add to include teammates
                  </p>
                ) : (
                  newCardAssignees.map((id) => {
                    const u = assignableUsers.find((x) => x.id === id) ?? users.find((x) => x.id === id);
                    if (!u) return null;
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 pl-1 pr-0.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-100 text-xs font-semibold text-indigo-900 max-w-full"
                      >
                        {u.avatar ? (
                          <img src={u.avatar} alt="" className="w-5 h-5 rounded-full object-cover shrink-0" />
                        ) : (
                          <span className="w-5 h-5 rounded-full bg-indigo-200 text-[9px] flex items-center justify-center shrink-0">
                            {(u.name ?? "?").charAt(0).toUpperCase()}
                          </span>
                        )}
                        <span className="truncate max-w-[7rem]">{u.name}</span>
                        <button
                          type="button"
                          onClick={() => removeNewCardAssignee(id)}
                          className="p-0.5 rounded-full hover:bg-indigo-200/60 text-indigo-700"
                          aria-label={`Remove ${u.name}`}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end p-6 sm:p-8 pt-4 border-t border-slate-100 shrink-0 bg-slate-50/30">
            <button
              type="button"
              onClick={() => cancelAdd()}
              className="w-full sm:w-auto px-5 py-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSubmitting || !newCardTitle.trim()}
              onClick={() => void submitNewCard()}
              className="w-full sm:w-auto min-w-[8rem] px-5 py-3 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-40 disabled:pointer-events-none transition-colors shadow-md shadow-indigo-200/50"
            >
              {isSubmitting ? "Adding…" : "Add card"}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};
