import React, { useState, useEffect, useMemo } from "react";
import {
  ArrowLeft,
  Calendar,
  Copy,
  FileText,
  Kanban,
  Link as LinkIcon,
  Mail,
  MoreHorizontal,
  Plus,
  Send,
  Upload,
  MessageSquare,
  CheckSquare,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { useAppContext } from "../context/AppContext";
import { KanbanBoard } from "../components/KanbanBoard";
import { useProjectExtras } from "../hooks/useProjectExtras";
import { useAuth } from "../context/AuthContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { WorkProgressBar } from "../components/WorkProgressBar";
import {
  combinedWorkProgressPercent,
  kanbanProgressStats,
  percentDone,
  todoListsProgressStats,
} from "../lib/projectProgress";
import {
  filterAssigneesForNotification,
  notifyTaskAssignment,
} from "../lib/notifyTaskAssignment";

export const ProjectDetail: React.FC<{ projectId: string | null; onBack: () => void }> = ({ projectId, onBack }) => {
  const { projects, users, deleteProject, currentUser, tasks } = useAppContext();
  const { user } = useAuth();
  const { workspaceId } = useWorkspace();
  const [activeWidget, setActiveWidget] = useState<string | null>(null);
  const [activeTodoList, setActiveTodoList] = useState<string | null>(null);
  const [activeTodoTask, setActiveTodoTask] = useState<string | null>(null);
  const [activeBoardThreadId, setActiveBoardThreadId] = useState<string | null>(null);
  const [isAddingList, setIsAddingList] = useState<boolean>(false);
  const [newListTitle, setNewListTitle] = useState<string>("");
  const [isAddingTask, setIsAddingTask] = useState<boolean>(false);
  const [newTaskTitle, setNewTaskTitle] = useState<string>("");
  const [newTaskAssigneeId, setNewTaskAssigneeId] = useState<string>("");
  const [newTaskDeadline, setNewTaskDeadline] = useState<string>("");
  const [showProjectMenu, setShowProjectMenu] = useState<boolean>(false);
  const [newThreadTitle, setNewThreadTitle] = useState("");
  const [newThreadBody, setNewThreadBody] = useState("");
  const [showNewThreadForm, setShowNewThreadForm] = useState(false);
  const [newBoardComment, setNewBoardComment] = useState("");
  const [newTodoComment, setNewTodoComment] = useState("");
  const [showAssigneePicker, setShowAssigneePicker] = useState(false);
  const [showDocsComingSoon, setShowDocsComingSoon] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSubmitAction, setInviteSubmitAction] = useState<null | "copy" | "email">(null);
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [showNewScheduleEventForm, setShowNewScheduleEventForm] = useState(false);
  const [newScheduleEventTitle, setNewScheduleEventTitle] = useState("");
  const [newScheduleEventDate, setNewScheduleEventDate] = useState("");
  const [newScheduleEventNotes, setNewScheduleEventNotes] = useState("");
  const [scheduleEventToDeleteId, setScheduleEventToDeleteId] = useState<string | null>(null);

  const project = projects.find(p => p.id === projectId);
  const extras = useProjectExtras(project?.id ?? null, activeBoardThreadId);

  useEffect(() => {
    setActiveWidget(null);
    setActiveTodoList(null);
    setActiveTodoTask(null);
    setActiveBoardThreadId(null);
    setShowNewThreadForm(false);
    setShowDocsComingSoon(false);
    setShowInviteModal(false);
    setInviteEmail("");
    setInviteMessage(null);
    setInviteError(null);
    setInviteSubmitAction(null);
    setShowNewScheduleEventForm(false);
    setNewScheduleEventTitle("");
    setNewScheduleEventDate("");
    setNewScheduleEventNotes("");
    setScheduleEventToDeleteId(null);
  }, [projectId]);

  useEffect(() => {
    setNewTodoComment("");
    setShowAssigneePicker(false);
  }, [activeTodoTask]);

  const todoLists = extras.todoLists;
  const boardTasks = project ? tasks.filter((t) => t.projectId === project.id) : [];
  const scheduleEventToDelete = extras.scheduleEvents.find((event) => event.id === scheduleEventToDeleteId);
  const boardSummary = useMemo(
    () => [
      { id: "todo" as const, label: "To do", n: boardTasks.filter((t) => t.status === "todo").length },
      {
        id: "in-progress" as const,
        label: "In progress",
        n: boardTasks.filter((t) => t.status === "in-progress").length,
      },
      { id: "review" as const, label: "Review", n: boardTasks.filter((t) => t.status === "review").length },
      { id: "done" as const, label: "Done", n: boardTasks.filter((t) => t.status === "done").length },
    ],
    [boardTasks]
  );

  const todoProgressStats = useMemo(() => todoListsProgressStats(todoLists), [todoLists]);
  const kanbanProgress = useMemo(() => kanbanProgressStats(boardTasks), [boardTasks]);
  const hubCombinedProgress = useMemo(
    () =>
      combinedWorkProgressPercent(
        kanbanProgress,
        todoProgressStats,
        project?.progress ?? 0
      ),
    [kanbanProgress, todoProgressStats, project?.progress]
  );
  const todoOnlyPercent = useMemo(
    () => percentDone(todoProgressStats.done, todoProgressStats.total),
    [todoProgressStats]
  );

  if (!project) return <div>Project not found</div>;

  const projectUsers = users.filter(u => project.team.includes(u.id));

  const handleAddList = () => {
    if (!newListTitle.trim()) {
      setIsAddingList(false);
      return;
    }
    void extras.createTodoList(newListTitle.trim());
    setNewListTitle("");
    setIsAddingList(false);
  };

  const toggleTaskCompletion = (listId: string, taskId: string) => {
    const list = todoLists.find((l) => l.id === listId);
    const task = list?.tasks.find((t) => t.id === taskId);
    if (!task) return;
    void extras.toggleTodoItem(taskId, !task.completed);
  };

  const sendTodoAssignmentEmails = (taskTitle: string, assigneeIds: string[]) => {
    if (!user || !workspaceId || !project) return;
    const toNotify = filterAssigneesForNotification(assigneeIds, currentUser, users, user.uid);
    if (toNotify.length === 0) return;
    void notifyTaskAssignment({
      firebaseUser: user,
      workspaceId,
      projectId: project.id,
      projectName: project.name,
      taskTitle,
      assigneeIds: toNotify,
      source: "todo",
    });
  };

  const handleAddTask = (listId: string) => {
    if (!newTaskTitle.trim()) {
      setIsAddingTask(false);
      return;
    }
    const title = newTaskTitle.trim();
    const assignees = newTaskAssigneeId ? [newTaskAssigneeId] : [];
    const dueDateIso = newTaskDeadline ? new Date(`${newTaskDeadline}T23:59:59`).toISOString() : undefined;
    void extras.createTodoItem(listId, title, assignees, dueDateIso);
    if (newTaskAssigneeId) {
      sendTodoAssignmentEmails(title, [newTaskAssigneeId]);
    }
    setNewTaskTitle("");
    setNewTaskDeadline("");
    setIsAddingTask(true);
  };

  const handleDeleteTodoTask = (taskId: string) => {
    const confirmed = window.confirm("Delete this task?");
    if (!confirmed) return;
    void extras.deleteTodoItem(taskId);
  };

  const handleDeleteTodoList = (listId: string) => {
    const confirmed = window.confirm("Delete this list and all tasks inside it?");
    if (!confirmed) return;
    void extras.deleteTodoList(listId);
    setActiveTodoList(null);
  };

  const handleAddAssigneeToTodoTask = (
    taskId: string,
    assignees: string[],
    assigneeId: string,
    taskTitle: string
  ) => {
    if (!assigneeId || assignees.includes(assigneeId)) return;
    void extras.updateTodoItem(taskId, { assignees: [...assignees, assigneeId] });
    sendTodoAssignmentEmails(taskTitle, [assigneeId]);
    setShowAssigneePicker(false);
  };

  const handleRemoveAssigneeFromTodoTask = (taskId: string, assignees: string[], assigneeId: string) => {
    void extras.updateTodoItem(taskId, { assignees: assignees.filter((id) => id !== assigneeId) });
  };

  const handleTodoDeadlineChange = (taskId: string, value: string) => {
    const dueDateIso = value ? new Date(`${value}T23:59:59`).toISOString() : null;
    void extras.updateTodoItem(taskId, { dueDate: dueDateIso });
  };

  const handleCloseWidget = () => {
    setActiveWidget(null);
    setActiveTodoList(null);
    setActiveTodoTask(null);
    setActiveBoardThreadId(null);
    setShowNewThreadForm(false);
    setShowNewScheduleEventForm(false);
    setScheduleEventToDeleteId(null);
    setNewBoardComment("");
    setNewTodoComment("");
  };

  const handleCreateScheduleEvent = () => {
    if (!newScheduleEventTitle.trim() || !newScheduleEventDate) return;
    void extras.createScheduleEvent(
      newScheduleEventTitle.trim(),
      newScheduleEventDate,
      newScheduleEventNotes.trim()
    );
    setNewScheduleEventTitle("");
    setNewScheduleEventDate("");
    setNewScheduleEventNotes("");
    setShowNewScheduleEventForm(false);
  };

  const handleConfirmDeleteScheduleEvent = () => {
    if (!scheduleEventToDeleteId) return;
    void extras.deleteScheduleEvent(scheduleEventToDeleteId);
    setScheduleEventToDeleteId(null);
  };

  const submitInvite = async (sendEmail: boolean) => {
    if (!user || !workspaceId) {
      setInviteError("Workspace is not ready yet. Please try again.");
      return;
    }
    const normalizedEmail = inviteEmail.trim().toLowerCase();
    if (sendEmail && !normalizedEmail) {
      setInviteError("Enter an email to send this invite.");
      return;
    }
    setInviteSubmitAction(sendEmail ? "email" : "copy");
    setInviteError(null);
    setInviteMessage(null);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch("/api/project-invites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          workspaceId,
          projectId: project.id,
          email: sendEmail ? normalizedEmail : undefined,
          sendEmail,
        }),
      });
      const payload = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !payload.url) {
        throw new Error(payload.error ?? "Failed to create invite link.");
      }

      if (sendEmail) {
        setInviteMessage(`Invite sent to ${normalizedEmail}.`);
      } else {
        await navigator.clipboard.writeText(payload.url);
        setInviteMessage("Invite link copied to clipboard.");
      }
    } catch (e) {
      setInviteError(e instanceof Error ? e.message : "Failed to create invite.");
    } finally {
      setInviteSubmitAction(null);
    }
  };

  const renderExpandedWidget = () => {
    switch (activeWidget) {
      case "kanban":
        return (
          <div className="h-full flex flex-col animate-in fade-in zoom-in-95 duration-200 px-4 pb-4 pt-4 md:px-6 md:pb-6 md:pt-6">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-black text-indigo-900 tracking-tight flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                  <Kanban size={20} className="stroke-[3px]" />
                </div>
                Features and Updates
              </h2>
              <button onClick={handleCloseWidget} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors">
                <X size={20} className="stroke-[3px]" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <KanbanBoard projectId={project.id} teamMemberIds={project.team} />
            </div>
          </div>
        );
      case "todos":
        if (activeTodoTask) {
           const list = todoLists.find(l => l.tasks.some(t => t.id === activeTodoTask));
           const task = list?.tasks.find(t => t.id === activeTodoTask);
           if (task && list) {
              return (
                 <div className="h-full flex flex-col animate-in slide-in-from-right-4 duration-200 overflow-hidden relative px-4 pb-4 pt-4 md:px-6 md:pb-6 md:pt-6">
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-3">
                        <button onClick={() => setActiveTodoTask(null)} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-50 text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors">
                          <ArrowLeft size={18} className="stroke-[3px]" />
                        </button>
                        <div>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{list.name}</p>
                          <h2 className="text-2xl font-black text-indigo-900 tracking-tight flex items-center gap-3">
                            {task.title}
                          </h2>
                        </div>
                      </div>
                      <button onClick={handleCloseWidget} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors">
                        <X size={20} className="stroke-[3px]" />
                      </button>
                    </div>
                    <div className="flex-1 overflow-auto flex flex-col md:flex-row gap-8">
                       {/* Left side: Task Content & Comments */}
                       <div className="flex-1 space-y-8">
                          <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                             <h3 className="font-bold text-slate-800 mb-2 text-sm">Description</h3>
                             <p className="text-slate-600 text-sm font-medium leading-relaxed">{task.description}</p>
                          </div>
                          
                          <div>
                             <h3 className="font-bold text-slate-800 mb-4 text-sm flex items-center gap-2">
                               <MessageSquare size={16} /> Comments ({task.comments.length})
                             </h3>
                             <div className="space-y-4 mb-4">
                                {task.comments.map((c) => {
                                  const author = users.find((u) => u.id === c.userId);
                                  const initial = (author?.name ?? "?").charAt(0).toUpperCase();
                                  return (
                                    <div key={c.id} className="flex gap-3">
                                      {author?.avatar ? (
                                        <img src={author.avatar} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-slate-200" />
                                      ) : (
                                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 font-bold flex items-center justify-center text-xs flex-shrink-0">{initial}</div>
                                      )}
                                      <div>
                                        <div className="bg-slate-50 rounded-2xl rounded-tl-none p-4 border border-slate-100 text-sm font-medium text-slate-700 whitespace-pre-wrap">
                                          {c.content}
                                        </div>
                                        <span className="text-[10px] font-bold text-slate-400 mt-1 ml-1 block">
                                          {author?.name ?? "Member"} · {format(new Date(c.createdAt), "MMM d, h:mm a")}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                             </div>
                             <div className="flex gap-3 items-end">
                                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 font-bold flex items-center justify-center text-xs flex-shrink-0 mb-1">
                                  {(currentUser.name || "?").charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 bg-white border border-slate-200 rounded-2xl p-2 flex items-end gap-2 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100 transition-all shadow-sm">
                                   <textarea 
                                     placeholder="Add a comment..."
                                     value={newTodoComment}
                                     onChange={(e) => setNewTodoComment(e.target.value)}
                                     className="flex-1 resize-none bg-transparent border-none focus:ring-0 text-sm font-medium p-2 min-h-[44px] max-h-32 text-slate-800 placeholder-slate-400"
                                     rows={1}
                                   />
                                   <button
                                     type="button"
                                     onClick={() => {
                                       if (!newTodoComment.trim() || !activeTodoTask) return;
                                       void extras.addTodoItemComment(activeTodoTask, newTodoComment.trim());
                                       setNewTodoComment("");
                                     }}
                                     className="bg-indigo-600 text-white p-2 rounded-xl h-10 w-10 flex items-center justify-center shrink-0 hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-200"
                                   >
                                      <Upload size={16} className="rotate-90 stroke-[3px]" />
                                   </button>
                                </div>
                             </div>
                          </div>
                       </div>
                       
                       {/* Right side: Meta details */}
                       <div className="w-full md:w-72 space-y-6">
                           <div>
                             <h3 className="font-bold text-slate-800 mb-3 text-xs uppercase tracking-widest flex items-center justify-between">
                                 Assignees
                                 <button
                                   type="button"
                                   onClick={() => setShowAssigneePicker((prev) => !prev)}
                                   className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors normal-case text-xs font-bold"
                                 >
                                   <Plus size={14} className="stroke-[3px]" /> Add
                                 </button>
                              </h3>
                              {showAssigneePicker && (
                                <div className="mb-3 rounded-xl border border-slate-200 bg-white p-2 shadow-sm space-y-1">
                                  {projectUsers.filter((u) => !task.assignees.includes(u.id)).length === 0 ? (
                                    <p className="text-xs font-medium text-slate-500 px-2 py-1">Everyone is already assigned</p>
                                  ) : (
                                    projectUsers
                                      .filter((u) => !task.assignees.includes(u.id))
                                      .map((u) => (
                                        <button
                                          key={u.id}
                                          type="button"
                                          onClick={() =>
                                            handleAddAssigneeToTodoTask(
                                              task.id,
                                              task.assignees,
                                              u.id,
                                              task.title
                                            )
                                          }
                                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors text-left"
                                        >
                                          <img src={u.avatar} alt={u.name} className="w-6 h-6 rounded-full border border-slate-200 object-cover" />
                                          <span className="text-sm font-semibold text-slate-700">{u.name}</span>
                                        </button>
                                      ))
                                  )}
                                </div>
                              )}
                              <div className="space-y-2">
                                 {task.assignees.length === 0 ? (
                                    <div className="text-sm font-medium text-slate-500 italic p-3 border border-dashed border-slate-200 rounded-xl bg-slate-50 text-center">Unassigned</div>
                                 ) : (
                                    task.assignees.map(id => {
                                       const u = projectUsers.find(pu => pu.id === id);
                                       return u ? (
                                        <div key={id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-colors group">
                                            <img src={u.avatar} alt={u.name} className="w-8 h-8 rounded-full border border-slate-200" />
                                            <span className="text-sm font-bold text-slate-700 flex-1">{u.name}</span>
                                            <button
                                              type="button"
                                              onClick={() => handleRemoveAssigneeFromTodoTask(task.id, task.assignees, id)}
                                              className="text-slate-300 opacity-0 group-hover:opacity-100 hover:text-rose-500 transition-all"
                                              title={`Remove ${u.name}`}
                                              aria-label={`Remove ${u.name}`}
                                            >
                                              <X size={14} />
                                            </button>
                                         </div>
                                       ) : null;
                                    })
                                 )}
                              </div>
                           </div>
                           
                           <div>
                              <h3 className="font-bold text-slate-800 mb-3 text-xs uppercase tracking-widest">Deadline</h3>
                             <input
                               type="date"
                               value={task.dueDate ? format(new Date(task.dueDate), "yyyy-MM-dd") : ""}
                               onChange={(e) => handleTodoDeadlineChange(task.id, e.target.value)}
                               className="w-full py-2.5 px-4 rounded-xl text-sm font-bold border border-slate-200 text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
                             />
                           </div>

                           <div>
                              <h3 className="font-bold text-slate-800 mb-3 text-xs uppercase tracking-widest">Status</h3>
                              <button 
                                onClick={() => toggleTaskCompletion(list.id, task.id)}
                                className={`w-full py-2.5 px-4 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-sm ${task.completed ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                              >
                                 <CheckSquare size={16} className={`stroke-[3px] ${task.completed ? 'text-emerald-500' : 'text-slate-400'}`} />
                                 {task.completed ? 'Completed' : 'Mark as Complete'}
                              </button>
                           </div>
                       </div>
                    </div>
                 </div>
              );
           }
        }
        
        if (activeTodoList) {
           const list = todoLists.find(l => l.id === activeTodoList);
           const listTodoPct = list
             ? percentDone(
                 list.tasks.filter((t) => t.completed).length,
                 list.tasks.length
               )
             : 0;
           return (
              <div className="h-full flex flex-col animate-in slide-in-from-right-4 duration-200 px-4 pb-4 pt-4 md:px-6 md:pb-6 md:pt-6">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setActiveTodoList(null)} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-50 text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors">
                      <ArrowLeft size={18} className="stroke-[3px]" />
                    </button>
                    <h2 className="text-2xl font-black text-indigo-900 tracking-tight flex items-center gap-3">
                      {list?.name}
                    </h2>
                  </div>
                  <div className="flex items-center gap-3">
                    {list && (
                      <button
                        type="button"
                        onClick={() => handleDeleteTodoList(list.id)}
                        className="h-10 w-10 rounded-full border border-slate-200 bg-white text-slate-400 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-colors flex items-center justify-center"
                        title="Delete list"
                        aria-label={`Delete list ${list.name}`}
                      >
                        <Trash2 size={16} className="stroke-[2.5px]" />
                      </button>
                    )}
                    <button 
                      onClick={() => {
                        setNewTaskDeadline("");
                        setIsAddingTask(true);
                      }}
                      className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md shadow-indigo-200 hover:bg-indigo-700 transition-colors flex items-center gap-2"
                    >
                      <Plus size={16} className="stroke-[3px]" /> Add Task
                    </button>
                    <button onClick={handleCloseWidget} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors">
                      <X size={20} className="stroke-[3px]" />
                    </button>
                  </div>
                </div>
                {list && list.tasks.length > 0 ? (
                  <div className="mb-4 max-w-md">
                    <WorkProgressBar label="This list" percent={listTodoPct} />
                  </div>
                ) : null}
                <div className="flex-1 overflow-auto bg-slate-50/50 rounded-2xl border border-slate-100 p-2 sm:p-6 space-y-2">
                   {list?.tasks.map(task => (
                      <div 
                         key={task.id} 
                         onClick={() => setActiveTodoTask(task.id)}
                         className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer flex items-center justify-between gap-4 group"
                      >
                         <div className="flex items-center gap-4 flex-1">
                            <button className="text-slate-300 hover:text-emerald-500 transition-colors" onClick={(e) => { e.stopPropagation(); toggleTaskCompletion(list.id, task.id); }}>
                               <CheckSquare size={20} className={`stroke-[2px] ${task.completed ? 'text-emerald-500' : ''}`} />
                            </button>
                            <span className={`font-bold text-sm ${task.completed ? 'text-slate-400 line-through' : 'text-slate-700 group-hover:text-indigo-700 transition-colors'}`}>
                               {task.title}
                            </span>
                         </div>
                         <div className="flex items-center gap-4">
                            {task.dueDate && (
                               <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
                                  <Calendar size={14} className="stroke-[3px]" /> {format(new Date(task.dueDate), "MMM d")}
                               </div>
                            )}
                            {task.comments.length > 0 && (
                               <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
                                  <MessageSquare size={14} className="stroke-[3px]" /> {task.comments.length}
                               </div>
                            )}
                            <div className="flex -space-x-2">
                              {task.assignees.map((id) => {
                                const u = projectUsers.find((pu) => pu.id === id);
                                return u ? (
                                  <img
                                    key={id}
                                    src={u.avatar}
                                    className="w-7 h-7 rounded-full border-2 border-white relative object-cover bg-slate-100 shadow-sm"
                                    alt={u.name}
                                  />
                                ) : null;
                              })}
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteTodoTask(task.id);
                              }}
                              className="h-8 w-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-colors bg-white shrink-0"
                              aria-label={`Delete task ${task.title}`}
                              title="Delete task"
                            >
                              <Trash2 size={15} />
                            </button>
                         </div>
                      </div>
                   ))}
                   {isAddingTask && (
                    <div className="bg-white p-4 rounded-xl border border-indigo-200 shadow-sm space-y-3">
                      <div className="flex items-center gap-4">
                        <CheckSquare size={20} className="stroke-[2px] text-slate-200" />
                        <input 
                          type="text" 
                          autoFocus
                          value={newTaskTitle}
                          onChange={(e) => setNewTaskTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddTask(list!.id);
                            if (e.key === 'Escape') setIsAddingTask(false);
                          }}
                          placeholder="What needs to be done?"
                          className="flex-1 bg-transparent border-none focus:outline-none text-sm font-bold text-slate-800 placeholder-slate-400"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <select
                          value={newTaskAssigneeId}
                          onChange={(e) => setNewTaskAssigneeId(e.target.value)}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        >
                          <option value="">Unassigned</option>
                          {projectUsers.map((u) => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                          ))}
                        </select>
                        <input
                          type="date"
                          value={newTaskDeadline}
                          onChange={(e) => setNewTaskDeadline(e.target.value)}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        />
                      </div>
                      {currentUser.id && !newTaskAssigneeId ? (
                        <button
                          type="button"
                          onClick={() => setNewTaskAssigneeId(currentUser.id)}
                          className="text-left text-xs font-bold text-indigo-600 hover:text-indigo-800"
                        >
                          Assign to me
                        </button>
                      ) : null}
                      {newTaskAssigneeId ? (
                        <p className="text-[11px] font-medium text-indigo-800 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
                          That person will see this task on their <span className="font-bold">My Tasks</span> page.
                        </p>
                      ) : null}
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setIsAddingTask(false)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 text-slate-600 hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddTask(list!.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700"
                        >
                          Save Task
                        </button>
                      </div>
                     </div>
                   )}
                </div>
              </div>
           );
        }

        return (
          <div className="h-full flex flex-col animate-in fade-in zoom-in-95 duration-200 px-4 pb-4 pt-4 md:px-6 md:pb-6 md:pt-6">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-black text-indigo-900 tracking-tight flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center">
                  <CheckSquare size={20} className="stroke-[3px]" />
                </div>
                To-Dos
              </h2>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setIsAddingList(true)}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md shadow-indigo-200 hover:bg-indigo-700 transition-colors flex items-center gap-2"
                >
                  <Plus size={16} className="stroke-[3px]" /> Add List
                </button>
                <button onClick={handleCloseWidget} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors">
                  <X size={20} className="stroke-[3px]" />
                </button>
              </div>
            </div>
            <div className="mb-6 max-w-md">
              <WorkProgressBar
                label={todoProgressStats.total > 0 ? "All lists" : "Lists"}
                percent={todoOnlyPercent}
              />
            </div>
            <div className="flex-1 overflow-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {todoLists.map(list => (
                 <div 
                   key={list.id} 
                   onClick={() => setActiveTodoList(list.id)}
                   className="bg-slate-50 p-6 rounded-2xl border border-slate-100 hover:bg-indigo-50/50 hover:border-indigo-100 transition-all cursor-pointer group flex flex-col h-full shadow-sm"
                 >
                   <div className="flex items-center justify-between mb-4">
                     <h3 className="text-lg font-black text-slate-800 group-hover:text-indigo-900 transition-colors tracking-tight">{list.name}</h3>
                     <span className="text-xs font-bold text-slate-400 bg-white px-2 py-1 rounded-lg shadow-sm border border-slate-100">{list.tasks.length} tasks</span>
                   </div>
                   <div className="space-y-3 flex-1">
                      {list.tasks.slice(0, 3).map(task => (
                        <div key={task.id} className="flex items-start gap-3">
                           <CheckSquare size={16} className={`mt-0.5 flex-shrink-0 ${task.completed ? 'text-emerald-500' : 'text-slate-300'}`} />
                           <span className={`text-sm font-medium line-clamp-1 ${task.completed ? 'text-slate-400 line-through' : 'text-slate-600'}`}>{task.title}</span>
                        </div>
                      ))}
                      {list.tasks.length > 3 && (
                        <div className="text-xs font-bold text-indigo-500 pt-2">+ {list.tasks.length - 3} more</div>
                      )}
                   </div>
                 </div>
               ))}
               {isAddingList && (
                 <div className="bg-indigo-50/50 p-6 rounded-2xl border border-indigo-200 shadow-sm flex flex-col h-full h-min-[150px]">
                   <input 
                     type="text" 
                     autoFocus
                     value={newListTitle}
                     onChange={(e) => setNewListTitle(e.target.value)}
                     onKeyDown={(e) => {
                       if (e.key === 'Enter') handleAddList();
                       if (e.key === 'Escape') setIsAddingList(false);
                     }}
                     onBlur={handleAddList}
                     placeholder="New List Name..."
                     className="bg-white border border-indigo-100 rounded-xl px-4 py-2 text-sm font-bold text-indigo-900 placeholder-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full mb-4 md:mb-auto shadow-sm"
                   />
                 </div>
               )}
            </div>
          </div>
        );
      case "messages": {
        const activeThread = activeBoardThreadId
          ? extras.threads.find((t) => t.id === activeBoardThreadId)
          : undefined;
        if (activeThread) {
          const author = users.find((u) => u.id === activeThread.userId);
          return (
            <div className="h-full flex flex-col animate-in fade-in zoom-in-95 duration-200 px-4 pb-4 pt-4 md:px-6 md:pb-6 md:pt-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveBoardThreadId(null);
                      setNewBoardComment("");
                    }}
                    className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-50 text-slate-500 hover:bg-slate-200"
                  >
                    <ArrowLeft size={18} className="stroke-[3px]" />
                  </button>
                  <h2 className="text-xl font-black text-indigo-900 tracking-tight line-clamp-1">{activeThread.title}</h2>
                </div>
                <button onClick={handleCloseWidget} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200">
                  <X size={20} className="stroke-[3px]" />
                </button>
              </div>
              <p className="text-slate-600 text-sm font-medium mb-6 whitespace-pre-wrap">{activeThread.content}</p>
              <p className="text-xs font-bold text-slate-400 mb-4">
                {author?.name ?? "Member"} · {format(new Date(activeThread.createdAt), "MMM d, yyyy h:mm a")}
              </p>
              <h3 className="font-bold text-slate-800 mb-3 text-sm">Replies ({extras.threadComments.length})</h3>
              <div className="flex-1 overflow-auto space-y-4 mb-4">
                {extras.threadComments.map((c) => {
                  const u = users.find((x) => x.id === c.userId);
                  const initial = (u?.name ?? "?").charAt(0).toUpperCase();
                  return (
                    <div key={c.id} className="flex gap-3">
                      {u?.avatar ? (
                        <img src={u.avatar} alt="" className="w-8 h-8 rounded-full object-cover border border-slate-200" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold flex items-center justify-center">{initial}</div>
                      )}
                      <div>
                        <div className="bg-slate-50 rounded-2xl rounded-tl-none p-3 border border-slate-100 text-sm text-slate-700 whitespace-pre-wrap">{c.content}</div>
                        <span className="text-[10px] font-bold text-slate-400 mt-1 ml-1 block">
                          {u?.name ?? "Member"} · {format(new Date(c.createdAt), "MMM d, h:mm a")}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <textarea
                  value={newBoardComment}
                  onChange={(e) => setNewBoardComment(e.target.value)}
                  placeholder="Write a reply…"
                  rows={2}
                  className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!newBoardComment.trim()) return;
                    void extras.addBoardThreadComment(activeThread.id, newBoardComment.trim());
                    setNewBoardComment("");
                  }}
                  className="self-end bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700"
                >
                  Send
                </button>
              </div>
            </div>
          );
        }
        if (showNewThreadForm) {
          return (
            <div className="h-full flex flex-col animate-in fade-in zoom-in-95 duration-200 px-4 pb-4 pt-4 md:px-6 md:pb-6 md:pt-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-black text-indigo-900 tracking-tight flex items-center gap-3">
                  <MessageSquare size={20} className="stroke-[3px]" /> New thread
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setShowNewThreadForm(false);
                    setNewThreadTitle("");
                    setNewThreadBody("");
                  }}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
                >
                  <X size={20} />
                </button>
              </div>
              <input
                type="text"
                value={newThreadTitle}
                onChange={(e) => setNewThreadTitle(e.target.value)}
                placeholder="Title"
                className="w-full mb-3 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
              <textarea
                value={newThreadBody}
                onChange={(e) => setNewThreadBody(e.target.value)}
                placeholder="What do you want to discuss?"
                rows={6}
                className="w-full flex-1 min-h-[160px] rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-200 mb-4"
              />
              <button
                type="button"
                onClick={() => {
                  if (!newThreadTitle.trim() || !newThreadBody.trim()) return;
                  void extras.createBoardThread(newThreadTitle.trim(), newThreadBody.trim());
                  setNewThreadTitle("");
                  setNewThreadBody("");
                  setShowNewThreadForm(false);
                }}
                className="bg-indigo-600 text-white px-6 py-3 rounded-xl text-sm font-bold hover:bg-indigo-700 self-start"
              >
                Post thread
              </button>
            </div>
          );
        }
        return (
          <div className="h-full flex flex-col animate-in fade-in zoom-in-95 duration-200 px-4 pb-4 pt-4 md:px-6 md:pb-6 md:pt-6">
             <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-black text-indigo-900 tracking-tight flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center">
                  <MessageSquare size={20} className="stroke-[3px]" />
                </div>
                Message Board
              </h2>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowNewThreadForm(true)}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md shadow-indigo-200 hover:bg-indigo-700 transition-colors flex items-center gap-2"
                >
                  <Plus size={16} className="stroke-[3px]" /> New Message
                </button>
                <button onClick={() => setActiveWidget(null)} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors">
                  <X size={20} className="stroke-[3px]" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto space-y-4">
              {extras.threads.length === 0 && (
                <p className="text-center text-slate-500 font-medium py-12">No threads yet. Start the conversation.</p>
              )}
              {extras.threads.map((th) => {
                const op = users.find((u) => u.id === th.userId);
                return (
                  <button
                    type="button"
                    key={th.id}
                    onClick={() => setActiveBoardThreadId(th.id)}
                    className="w-full text-left bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <h3 className="text-lg font-black text-slate-800 mb-2">{th.title}</h3>
                    <p className="text-slate-500 text-sm font-medium mb-4 line-clamp-2">{th.content}</p>
                    <div className="flex items-center gap-3">
                      {op?.avatar ? (
                        <img src={op.avatar} alt="" className="w-8 h-8 rounded-full border-2 border-white object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold flex items-center justify-center">
                          {(op?.name ?? "?").charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="text-xs font-bold text-slate-400">
                        {th.commentCount} {th.commentCount === 1 ? "reply" : "replies"} · {format(new Date(th.createdAt), "MMM d")}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
         );
      }
      case "schedule":
         return (
          <div className="h-full flex flex-col animate-in fade-in zoom-in-95 duration-200 px-4 pb-4 pt-4 md:px-6 md:pb-6 md:pt-6">
             <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-black text-indigo-900 tracking-tight flex items-center gap-3">
                <div className="w-10 h-10 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center">
                  <Calendar size={20} className="stroke-[3px]" />
                </div>
                Schedule
              </h2>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowNewScheduleEventForm(true)}
                  className="bg-rose-500 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md shadow-rose-200 hover:bg-rose-600 transition-colors flex items-center gap-2"
                >
                  <Plus size={16} className="stroke-[3px]" /> Add Event
                </button>
                <button onClick={handleCloseWidget} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors">
                  <X size={20} className="stroke-[3px]" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-slate-50 rounded-2xl border border-slate-100 p-4 sm:p-6">
              {showNewScheduleEventForm && (
                <div className="mb-6 bg-white rounded-2xl border border-rose-100 shadow-sm p-5 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_180px] gap-3">
                    <input
                      type="text"
                      autoFocus
                      value={newScheduleEventTitle}
                      onChange={(e) => setNewScheduleEventTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleCreateScheduleEvent();
                        if (e.key === "Escape") setShowNewScheduleEventForm(false);
                      }}
                      placeholder="Event title"
                      className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                    />
                    <input
                      type="date"
                      value={newScheduleEventDate}
                      onChange={(e) => setNewScheduleEventDate(e.target.value)}
                      className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-100"
                    />
                  </div>
                  <textarea
                    value={newScheduleEventNotes}
                    onChange={(e) => setNewScheduleEventNotes(e.target.value)}
                    placeholder="Notes, agenda, or link (optional)"
                    rows={3}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-100 resize-none"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowNewScheduleEventForm(false)}
                      className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 text-slate-600 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateScheduleEvent}
                      disabled={!newScheduleEventTitle.trim() || !newScheduleEventDate}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-50"
                    >
                      Save Event
                    </button>
                  </div>
                </div>
              )}
              <div className="space-y-3">
                {extras.scheduleEvents.map((event) => {
                  const author = users.find((u) => u.id === event.createdBy);
                  return (
                    <div key={event.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-start gap-4 group">
                      <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-500 flex flex-col items-center justify-center shrink-0">
                        <span className="text-[10px] font-black uppercase">{format(new Date(event.eventDate), "MMM")}</span>
                        <span className="text-lg font-black leading-none">{format(new Date(event.eventDate), "d")}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-black text-slate-800 text-sm line-clamp-1">{event.title}</h3>
                        <p className="text-xs font-medium text-slate-500 mt-1">
                          {format(new Date(event.eventDate), "EEEE, MMMM d, yyyy")}
                          {author ? ` · Added by ${author.name}` : ""}
                        </p>
                        {event.notes && (
                          <p className="text-sm font-medium text-slate-600 mt-3 whitespace-pre-wrap">{event.notes}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setScheduleEventToDeleteId(event.id)}
                        className="h-9 w-9 rounded-full border border-rose-100 bg-rose-50 flex items-center justify-center text-rose-500 hover:bg-rose-100 hover:text-rose-700 hover:border-rose-200 transition-colors shrink-0"
                        aria-label={`Delete event ${event.title}`}
                        title="Delete event"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  );
                })}
                {extras.scheduleEvents.length === 0 && !showNewScheduleEventForm && (
                  <div className="text-center py-12">
                    <Calendar className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-slate-700">No scheduled events yet</h3>
                    <p className="text-sm text-slate-500 mt-2">Add milestones, meetings, or review dates for this project.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
         );
      default:
        return null;
    }
  };

  return (
    <div
      className={
        activeWidget
          ? "relative flex h-full min-h-0 flex-col overflow-hidden"
          : "relative px-6 pb-12 pt-2 md:px-8 md:pt-3"
      }
    >
      {/* Header Utilities */}
      {!activeWidget && (
        <div className="mt-3 mb-2 flex shrink-0 justify-between gap-4 md:mt-4" onClick={() => setShowProjectMenu(false)}>
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 mb-1 transition-colors h-fit"
          >
            <ArrowLeft size={16} className="stroke-[3px]" />
            Back to Projects
          </button>
          <div className="relative">
            <button 
              onClick={(e) => { e.stopPropagation(); setShowProjectMenu(!showProjectMenu); }}
              className="h-8 w-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors bg-white"
            >
              <MoreHorizontal size={16} />
            </button>
            {showProjectMenu && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-100 rounded-2xl shadow-xl shadow-indigo-100/50 p-2 z-50">
                <button className="w-full text-left px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 hover:text-indigo-600 rounded-xl transition-colors mb-1">Edit Project</button>
                <button className="w-full text-left px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 hover:text-indigo-600 rounded-xl transition-colors mb-1">Archive Project</button>
                <button 
                  className="w-full text-left px-4 py-2 text-sm font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                  onClick={() => {
                     if (deleteProject && project) {
                        void deleteProject(project.id);
                     }
                     onBack();
                  }}
                >Delete Project</button>
              </div>
            )}
          </div>
        </div>
      )}

      {activeWidget ? (
        <div
          className={
            activeWidget === "todos"
              ? "flex min-h-0 flex-1 flex-col overflow-hidden px-2 pb-3 md:px-4 md:pb-4"
              : activeWidget === "messages"
                ? "flex min-h-0 flex-1 flex-col overflow-hidden px-2 pb-3 md:px-4 md:pb-4"
              : activeWidget === "schedule"
                ? "flex min-h-0 flex-1 flex-col overflow-hidden px-2 pb-3 md:px-4 md:pb-4"
              : activeWidget === "kanban"
                ? "flex min-h-0 flex-1 flex-col overflow-hidden px-2 pb-3 md:px-4 md:pb-4"
              : "flex min-h-0 flex-1 flex-col overflow-hidden px-6 pb-6 md:px-8"
          }
        >
          {renderExpandedWidget()}
        </div>
      ) : (
        <div>
          {/* Centered Project Title & Updates */}
          <div className="mb-10 flex flex-col items-center justify-center">
            <h1 className="text-4xl sm:text-5xl font-black text-indigo-950 tracking-tight mb-8 text-center">{project.name}</h1>
            
            <div className="w-full max-w-xs mx-auto mb-6 space-y-2">
              <WorkProgressBar
                label=""
                percent={hubCombinedProgress}
                trackClassName="bg-slate-200"
              />
              {kanbanProgress.total + todoProgressStats.total === 0 ? (
                <p className="text-center text-[11px] font-medium text-slate-400">
                  Add Kanban cards or checklist tasks to fill this bar.
                </p>
              ) : null}
            </div>

            {/* Set up people row */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setInviteMessage(null);
                  setInviteError(null);
                  setShowInviteModal(true);
                }}
                className="px-4 py-1.5 rounded-full border border-slate-200 text-xs font-bold text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition-colors bg-white shadow-sm"
              >
                Set up people
              </button>
              <div className="flex -space-x-2">
                {projectUsers.map((u, i) => (
                  <img key={u.id} src={u.avatar} alt={u.name} className="w-8 h-8 rounded-full border-2 border-white relative object-cover shadow-sm" style={{ zIndex: projectUsers.length - i }} />
                ))}
              </div>
            </div>
          </div>

          {/* App Grid View */}
          <div className="grid w-full grid-cols-1 gap-6 pb-12 md:grid-cols-2 lg:grid-cols-3">
            {/* Message Board */}
            <div 
              onClick={() => setActiveWidget("messages")}
              className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 hover:shadow-md hover:border-indigo-100 hover:-translate-y-1 transition-all group cursor-pointer flex flex-col h-72"
            >
              <h2 className="text-center font-black text-indigo-900 mb-6 group-hover:text-indigo-600 transition-colors text-lg tracking-tight">Message Board</h2>
              <div className="flex-1 space-y-4">
                {extras.threads[0] ? (
                  <div className="flex gap-4">
                    {(() => {
                      const u = users.find((x) => x.id === extras.threads[0]!.userId);
                      const initial = (u?.name ?? "?").charAt(0).toUpperCase();
                      return u?.avatar ? (
                        <img src={u.avatar} alt="" className="w-10 h-10 rounded-full object-cover border border-slate-200 flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">{initial}</div>
                      );
                    })()}
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-800 line-clamp-1 mb-0.5">{extras.threads[0].title}</div>
                      <div className="text-xs font-medium text-slate-500 line-clamp-2">{extras.threads[0].content}</div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 font-medium text-center">No threads yet — open to add one.</p>
                )}
              </div>
            </div>

            {/* To-Dos */}
            <div 
              onClick={() => setActiveWidget("todos")}
              className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 hover:shadow-md hover:border-indigo-100 hover:-translate-y-1 transition-all group cursor-pointer flex flex-col h-auto sm:h-72 col-span-1 md:col-span-2"
            >
              <h2 className="text-center font-black text-indigo-900 mb-4 group-hover:text-indigo-600 transition-colors text-lg tracking-tight">To-Dos</h2>
              {todoProgressStats.total > 0 ? (
                <div className="mb-4 px-2 pointer-events-none" aria-hidden>
                  <WorkProgressBar label="List tasks" percent={todoOnlyPercent} trackClassName="bg-slate-100" />
                </div>
              ) : (
                <p className="text-center text-[11px] font-medium text-slate-400 mb-4 pointer-events-none">No checklist tasks yet</p>
              )}
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6 overflow-hidden">
                {todoLists.slice(0, 2).map(list => (
                  <div key={list.id} onClick={(e) => { e.stopPropagation(); setActiveWidget("todos"); setActiveTodoList(list.id); }} className="bg-slate-50/50 p-4 rounded-2xl border border-slate-50 hover:bg-indigo-50/50 hover:border-indigo-100 transition-colors cursor-pointer group/col">
                      <h3 className="font-bold text-slate-900 text-sm mb-3 group-hover/col:text-indigo-700 transition-colors">{list.name}</h3>
                      <div className="space-y-3 pointer-events-none">
                          {list.tasks.slice(0, 2).map(task => (
                            <label key={task.id} className="flex items-start gap-3 text-sm font-medium text-slate-600">
                              <input type="checkbox" checked={task.completed} onChange={() => {}} className="mt-0.5 rounded border-slate-300 text-indigo-600" />
                              <span className={`line-clamp-1 ${task.completed ? 'line-through text-slate-400' : ''}`}>{task.title}</span>
                            </label>
                          ))}
                      </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Schedule */}
            <div 
              onClick={() => setActiveWidget("schedule")}
              className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 hover:shadow-md hover:border-indigo-100 hover:-translate-y-1 transition-all group cursor-pointer flex flex-col items-center justify-center text-center h-72"
            >
              <h2 className="font-black text-indigo-900 mb-4 group-hover:text-amber-500 transition-colors text-lg tracking-tight">Schedule</h2>
              <div className="w-16 h-16 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center mb-4">
                <Calendar size={28} className="stroke-[2.5px]" />
              </div>
              <p className="text-xs text-slate-500 mb-6 px-4 font-medium leading-relaxed">
                {extras.scheduleEvents[0]
                  ? `Next: ${extras.scheduleEvents[0].title} on ${format(new Date(extras.scheduleEvents[0].eventDate), "MMM d")}`
                  : "Set important dates on a shared schedule."}
              </p>
              <button className="px-5 py-2 rounded-full border border-slate-200 text-xs font-bold text-slate-600 group-hover:bg-slate-50 group-hover:border-slate-300 transition-colors shadow-sm pointer-events-none">
                {extras.scheduleEvents.length > 0
                  ? `${extras.scheduleEvents.length} event${extras.scheduleEvents.length === 1 ? "" : "s"}`
                  : "Schedule an event"}
              </button>
            </div>

            {/* Docs & Files */}
            <div 
              onClick={() => setShowDocsComingSoon(true)}
              className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 hover:shadow-md hover:border-indigo-100 hover:-translate-y-1 transition-all group cursor-pointer flex flex-col h-72"
            >
              <h2 className="text-center font-black text-indigo-900 mb-6 group-hover:text-sky-500 transition-colors text-lg tracking-tight">Docs & Files</h2>
              <div className="flex-1 flex flex-col items-center relative overflow-hidden pointer-events-none">
                 <div className="flex justify-center gap-3 w-full px-2">
                    {extras.files.slice(0, 3).map((f, i) => (
                      <div
                        key={f.id}
                        className={`w-16 h-20 bg-slate-50 border border-slate-200 rounded-xl shadow-sm flex flex-col items-center justify-center p-1 relative z-10 ${i === 1 ? "mt-4 z-20 bg-white" : ""}`}
                        title={f.name}
                      >
                        <FileText className="text-slate-400 stroke-[2px] shrink-0" size={18} />
                        <span className="text-[8px] font-bold text-slate-500 line-clamp-2 text-center mt-1 leading-tight">{f.name}</span>
                      </div>
                    ))}
                    {extras.files.length === 0 && (
                      <>
                        <div className="w-16 h-20 bg-slate-50 border border-slate-200 rounded-xl shadow-sm flex items-center justify-center relative z-10">
                          <FileText className="text-slate-400 stroke-[2px]" size={20} />
                        </div>
                        <div className="w-16 h-20 bg-slate-50 border border-slate-200 rounded-xl shadow-sm flex items-center justify-center relative z-10 mt-4">
                          <LinkIcon className="text-amber-400 stroke-[2.5px]" size={20} />
                        </div>
                      </>
                    )}
                 </div>
                 {extras.files.length > 0 && (
                   <p className="text-[10px] font-bold text-slate-400 mt-3">{extras.files.length} file{extras.files.length === 1 ? "" : "s"} in Storage</p>
                 )}
              </div>
            </div>

            {/* Features and Updates (Kanban) */}
            <div 
              onClick={() => setActiveWidget("kanban")}
              className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 hover:shadow-md hover:border-indigo-100 hover:-translate-y-1 transition-all group cursor-pointer flex flex-col items-center justify-center text-center h-72"
            >
              <h2 className="font-black text-indigo-900 mb-3 group-hover:text-emerald-500 transition-colors text-lg tracking-tight">Features and Updates</h2>
              <div className="w-16 h-16 bg-amber-100 text-amber-500 rounded-full flex items-center justify-center mb-3">
                  <Kanban size={28} className="stroke-[2.5px]" />
              </div>
              <div className="flex flex-wrap justify-center gap-1.5 mb-4 px-2 max-w-[17rem]">
                {boardSummary.map((s) => (
                  <span
                    key={s.id}
                    className="text-[9px] font-black uppercase tracking-wide text-slate-600 bg-slate-50 border border-slate-200/80 rounded-full px-2 py-1"
                  >
                    {s.label} · {s.n}
                  </span>
                ))}
              </div>
             
              <span className="px-5 py-2 rounded-full border border-slate-200 text-xs font-bold text-slate-600 group-hover:bg-slate-50 group-hover:border-slate-300 transition-colors shadow-sm pointer-events-none">
                {boardTasks.length === 0 ? "Open board — add a card" : `Open board (${boardTasks.length} card${boardTasks.length === 1 ? "" : "s"})`}
              </span>
            </div>

            {/* MVP Checklist */}
            <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 hover:shadow-md transition-shadow group cursor-pointer flex flex-col items-center justify-center text-center h-72 hover:-translate-y-1 hover:border-indigo-100">
              <h2 className="font-black text-indigo-900 mb-6 group-hover:text-emerald-500 transition-colors text-lg tracking-tight">Project MVP Checklist</h2>
              <div className="w-20 h-24 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-center mb-6 shadow-sm group-hover:-translate-y-2 transition-transform">
                 <div className="w-12 h-12 bg-emerald-500 rounded-lg flex items-center justify-center text-white shadow-md shadow-emerald-200">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                 </div>
              </div>
              <button className="px-5 py-2 rounded-full text-emerald-600 text-xs font-bold group-hover:bg-emerald-50 transition-colors outline outline-1 outline-emerald-200 shadow-sm outline-offset-2 pointer-events-none">
                Open up ↗
              </button>
            </div>
          </div>
        </div>
      )}

      {showDocsComingSoon && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="docs-coming-soon-title"
          onClick={() => setShowDocsComingSoon(false)}
        >
          <div
            className="bg-white rounded-[2rem] p-8 max-w-md w-full shadow-2xl border border-indigo-50 animate-in zoom-in-95 duration-200 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowDocsComingSoon(false)}
              className="absolute top-5 right-5 w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
              aria-label="Close"
            >
              <X size={20} className="stroke-[3px]" />
            </button>
            <div className="w-14 h-14 bg-sky-100 text-sky-600 rounded-2xl flex items-center justify-center mb-6">
              <FileText size={28} className="stroke-[2.5px]" />
            </div>
            <p className="text-[10px] font-black text-sky-600 uppercase tracking-widest mb-2">Coming soon</p>
            <h2 id="docs-coming-soon-title" className="text-2xl font-black text-indigo-900 tracking-tight mb-3 pr-10">
              Docs & Files
            </h2>
            <p className="text-slate-600 text-sm font-medium leading-relaxed mb-8">
              Shared documents, uploads, and file management for this project are not available yet—we're building this next.
            </p>
            <button
              type="button"
              onClick={() => setShowDocsComingSoon(false)}
              className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-200"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {scheduleEventToDelete && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-schedule-event-title"
          onClick={() => setScheduleEventToDeleteId(null)}
        >
          <div
            className="bg-white rounded-[2rem] p-6 sm:p-8 w-full max-w-md shadow-2xl border border-rose-100 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mb-6">
              <Trash2 size={26} className="stroke-[2.5px]" />
            </div>
            <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-2">Delete schedule</p>
            <h2 id="delete-schedule-event-title" className="text-2xl font-black text-indigo-900 tracking-tight mb-3">
              Delete "{scheduleEventToDelete.title}"?
            </h2>
            <p className="text-slate-600 text-sm font-medium leading-relaxed mb-8">
              This will remove the schedule event from this project and the Calendar page.
            </p>
            <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
              <button
                type="button"
                onClick={() => setScheduleEventToDeleteId(null)}
                className="px-5 py-3 rounded-xl text-sm font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteScheduleEvent}
                className="px-5 py-3 rounded-xl text-sm font-bold bg-rose-500 text-white hover:bg-rose-600 transition-colors shadow-md shadow-rose-200"
              >
                Delete Event
              </button>
            </div>
          </div>
        </div>
      )}

      {showInviteModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="invite-people-title"
          onClick={() => setShowInviteModal(false)}
        >
          <div
            className="bg-white rounded-[2rem] p-6 sm:p-8 w-full max-w-4xl xl:max-w-5xl shadow-2xl border border-indigo-100/80 animate-in zoom-in-95 duration-200 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowInviteModal(false)}
              className="absolute top-4 right-4 sm:top-5 sm:right-5 w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors shrink-0"
              aria-label="Close"
            >
              <X size={20} className="stroke-[3px]" />
            </button>

            <div className="flex gap-4 pr-10 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                <UserPlus size={24} className="stroke-[2px]" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">
                  Invite people
                </p>
                <h2 id="invite-people-title" className="text-xl sm:text-2xl font-black text-indigo-900 tracking-tight leading-tight">
                  Add teammates to {project.name}
                </h2>
                <p className="text-slate-500 text-sm font-medium mt-2 leading-relaxed">
                  Pick how you want to invite them. They use <span className="text-slate-700 font-semibold">Google sign-in</span> to join, then they are added to this project.
                </p>
              </div>
            </div>

            <div className="flex flex-col md:flex-row md:gap-8 md:items-stretch">
              <section
                className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 flex flex-col min-h-0 flex-1 min-w-0"
                aria-labelledby="invite-section-link"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white border border-slate-200 text-indigo-600">
                    <LinkIcon size={16} className="stroke-[2.5px]" />
                  </span>
                  <h3 id="invite-section-link" className="text-sm font-black text-indigo-900 uppercase tracking-wide">
                    Share a link
                  </h3>
                </div>
                <ol className="text-xs text-slate-600 font-medium space-y-1.5 mb-4 list-decimal list-inside leading-relaxed flex-1">
                  <li>Click the button below to copy an invite link.</li>
                  <li>Send it however you like (message, Slack, etc.).</li>
                  <li>They open the link and sign in with Google to join.</li>
                </ol>
                <button
                  type="button"
                  disabled={inviteSubmitAction === "copy"}
                  onClick={() => void submitInvite(false)}
                  className="w-full inline-flex items-center justify-center gap-2 bg-indigo-600 text-white font-bold py-3.5 px-4 rounded-xl hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-200/50 disabled:opacity-50 disabled:pointer-events-none mt-auto"
                >
                  <Copy size={18} className="shrink-0" />
                  {inviteSubmitAction === "copy" ? "Creating link…" : "Copy invite link"}
                </button>
              </section>

              <div className="flex md:hidden items-center gap-3 py-3 shrink-0" aria-hidden>
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">or</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              <section
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col min-h-0 flex-1 min-w-0"
                aria-labelledby="invite-section-email"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600">
                    <Mail size={16} className="stroke-[2.5px]" />
                  </span>
                  <h3 id="invite-section-email" className="text-sm font-black text-indigo-900 uppercase tracking-wide">
                    Email an invite
                  </h3>
                </div>
                <p className="text-xs text-slate-600 font-medium leading-relaxed mb-4">
                  We email them the same link. For security, they must sign in with a Google account that uses{" "}
                  <span className="text-slate-800 font-semibold">this exact email address</span>.
                </p>
                <label htmlFor="invite-email-input" className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Their email
                </label>
                <input
                  id="invite-email-input"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 focus:bg-white transition-shadow mb-4"
                />
                <button
                  type="button"
                  disabled={inviteSubmitAction === "email"}
                  onClick={() => void submitInvite(true)}
                  className="w-full inline-flex items-center justify-center gap-2 border-2 border-indigo-200 bg-indigo-50/80 text-indigo-800 font-bold py-3.5 px-4 rounded-xl hover:bg-indigo-100 hover:border-indigo-300 transition-colors disabled:opacity-50 disabled:pointer-events-none mt-auto"
                >
                  <Send size={18} className="shrink-0" />
                  {inviteSubmitAction === "email" ? "Sending…" : "Send invite by email"}
                </button>
              </section>
            </div>

            {(inviteMessage || inviteError) && (
              <div
                className={`mt-5 rounded-2xl px-4 py-3 text-sm font-semibold ${
                  inviteError ? "bg-rose-50 text-rose-800 border border-rose-100" : "bg-emerald-50 text-emerald-900 border border-emerald-100"
                }`}
                role="status"
              >
                {inviteError ?? inviteMessage}
              </div>
            )}

            <p className="mt-5 text-center text-[11px] font-medium text-slate-400">
              Invite links expire after 14 days.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};