import React, { useMemo } from "react";
import { useAppContext } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { collectUserIdentityIds, isUserAmongAssignees } from "../lib/firestoreMappers";
import { useProjectTodoCountsByProject } from "../hooks/useProjectTodoCountsByProject";
import { WorkProgressBar } from "../components/WorkProgressBar";
import { combinedWorkProgressPercent, kanbanProgressStats } from "../lib/projectProgress";
import { useMyAssignedProjectTodoItems } from "../hooks/useMyAssignedProjectTodoItems";
import { CheckCircle, TrendingUp, Clock, AlertCircle } from "lucide-react";
import { format, isValid } from "date-fns";
import type { ProjectTodoItem, Task } from "../types";
import type { MyTasksRowFocus } from "./MyTasks";

type UpcomingRow =
  | { kind: "kanban"; task: Task }
  | { kind: "todo"; projectId: string; item: ProjectTodoItem };

function formatDueLabel(iso: string | undefined): string {
  if (!iso) return "No due date";
  const d = new Date(iso);
  return isValid(d) ? format(d, "MMM d, yyyy") : "No due date";
}

function dueSortKey(iso: string | undefined): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
}

export const Dashboard: React.FC<{
  onProjectClick: (id: string) => void;
  onOpenMyTasks: (focus: MyTasksRowFocus) => void;
}> = ({ onProjectClick, onOpenMyTasks }) => {
  const { currentUser, projects, tasks, users } = useAppContext();
  const { user } = useAuth();
  const { workspaceId } = useWorkspace();
  const projectIds = useMemo(() => projects.map((p) => p.id), [projects]);
  const identityIds = useMemo(
    () => collectUserIdentityIds(currentUser.id, user?.uid ?? null, users, currentUser.email),
    [currentUser.id, currentUser.email, user?.uid, users]
  );
  const { assignedTodoRows } = useMyAssignedProjectTodoItems(workspaceId, identityIds, projectIds);
  const todoCountsByProject = useProjectTodoCountsByProject(workspaceId, projectIds);

  const myKanbanTasks = useMemo(
    () => tasks.filter((t) => identityIds.some((id) => isUserAmongAssignees(t.assignees, id))),
    [tasks, identityIds]
  );

  const completedTasks =
    myKanbanTasks.filter((t) => t.status === "done").length +
    assignedTodoRows.filter(({ item }) => item.completed).length;

  const totalAssigned =
    myKanbanTasks.length + assignedTodoRows.length;

  const pendingTasks =
    myKanbanTasks.filter((t) => t.status !== "done").length +
    assignedTodoRows.filter(({ item }) => !item.completed).length;

  const urgentTasks = myKanbanTasks.filter((t) => t.priority === "urgent" && t.status !== "done").length;

  const upcomingRows: UpcomingRow[] = useMemo(() => {
    const kanban: UpcomingRow[] = myKanbanTasks
      .filter((t) => t.status !== "done")
      .map((task) => ({ kind: "kanban" as const, task }));
    const todo: UpcomingRow[] = assignedTodoRows
      .filter(({ item }) => !item.completed)
      .map(({ projectId, item }) => ({ kind: "todo" as const, projectId, item }));
    return [...kanban, ...todo].sort((a, b) => {
      const da = a.kind === "kanban" ? a.task.dueDate : a.item.dueDate;
      const db = b.kind === "kanban" ? b.task.dueDate : b.item.dueDate;
      return dueSortKey(da) - dueSortKey(db);
    });
  }, [myKanbanTasks, assignedTodoRows]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-indigo-900 tracking-tight">Welcome back, {currentUser.name.split(' ')[0]} 👋</h1>
          <p className="text-slate-500 mt-1 font-medium">Here's what's happening with your projects today.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Total Tasks", value: totalAssigned, icon: CheckCircle, color: "text-blue-600", bg: "bg-blue-100" },
          { label: "Completed", value: completedTasks, icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-100" },
          { label: "Pending", value: pendingTasks, icon: Clock, color: "text-amber-600", bg: "bg-amber-100" },
          { label: "Urgent", value: urgentTasks, icon: AlertCircle, color: "text-red-600", bg: "bg-red-100" },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-5 rounded-[2rem] border border-indigo-50 shadow-xl shadow-indigo-100/40 flex items-center gap-4 hover:shadow-indigo-100/80 transition-shadow">
            <div className={`p-3 rounded-2xl ${stat.bg} ${stat.color}`}>
              <stat.icon size={24} />
            </div>
            <div>
              <div className="text-2xl font-black text-indigo-900">{stat.value}</div>
              <div className="text-sm font-medium text-slate-500">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-6 pb-8">
          {/* Active Projects */}
          <div className="bg-white rounded-[2.5rem] border border-indigo-50 shadow-xl shadow-indigo-100/50 p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-indigo-900">Active Projects</h2>
              <button className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider hover:bg-indigo-200">View All</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {projects.map((project) => {
                const kanban = kanbanProgressStats(tasks.filter((t) => t.projectId === project.id));
                const todoAgg = todoCountsByProject[project.id] ?? { total: 0, completed: 0 };
                const progressPct = combinedWorkProgressPercent(
                  kanban,
                  { done: todoAgg.completed, total: todoAgg.total },
                  project.progress
                );
                return (
                <div 
                  key={project.id} 
                  onClick={() => onProjectClick(project.id)}
                  className="p-5 rounded-3xl border border-slate-100 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer bg-white shadow-sm group"
                >
                  <h3 className="font-bold text-slate-800 mb-2 group-hover:text-indigo-700">{project.name}</h3>
                  <p className="text-sm text-slate-500 mb-4 line-clamp-2">{project.description}</p>
                  <WorkProgressBar
                    label="Progress "
                    percent={progressPct}
                    trackClassName="bg-slate-200"
                  />
                </div>
                );
              })}
            </div>
          </div>

          {/* Recent Tasks */}
          <div className="bg-white rounded-[2.5rem] border border-indigo-50 shadow-xl shadow-indigo-100/50 p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-indigo-900">My Upcoming Tasks</h2>
              <button className="bg-rose-500 text-white w-8 h-8 rounded-full font-bold shadow-lg shadow-rose-200 flex items-center justify-center">+</button>
            </div>
            <div className="space-y-3">
              {upcomingRows.slice(0, 5).map((row) => {
                if (row.kind === "kanban") {
                  const task = row.task;
                  const hot = task.priority === "urgent" || task.priority === "high";
                  return (
                    <div
                      key={`k:${task.id}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => onOpenMyTasks({ kind: "kanban", taskId: task.id })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onOpenMyTasks({ kind: "kanban", taskId: task.id });
                        }
                      }}
                      className={`flex items-center justify-between p-4 rounded-2xl transition-colors cursor-pointer ${hot ? "bg-indigo-50 border-white border-l-4 border-l-indigo-500 shadow-sm hover:bg-indigo-100/80" : "bg-white border border-slate-100 shadow-sm hover:border-indigo-100"}`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          readOnly
                          className={`w-5 h-5 rounded ${hot ? "border-indigo-300 text-indigo-600" : "border-slate-300 text-indigo-600"}`}
                        />
                        <div>
                          <div className={`font-bold ${hot ? "text-indigo-900" : "text-slate-700"}`}>{task.title}</div>
                          <div className="text-[10px] text-slate-400 font-bold flex items-center gap-2 uppercase tracking-wide mt-1">
                            <span>DUE: {formatDueLabel(task.dueDate)}</span>
                          </div>
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${task.priority === "urgent" ? "bg-rose-100 text-rose-600" : "bg-indigo-100 text-indigo-600"}`}
                      >
                        {task.status.replace("-", " ")}
                      </span>
                    </div>
                  );
                }
                const { projectId, item } = row;
                return (
                  <div
                    key={`t:${projectId}:${item.id}`}
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      onOpenMyTasks({ kind: "todo", projectId, itemId: item.id })
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onOpenMyTasks({ kind: "todo", projectId, itemId: item.id });
                      }
                    }}
                    className="flex items-center justify-between p-4 rounded-2xl transition-colors bg-white border border-slate-100 shadow-sm hover:border-indigo-100 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <input type="checkbox" readOnly className="w-5 h-5 rounded border-slate-300 text-indigo-600" />
                      <div>
                        <div className="font-bold text-slate-700">{item.title}</div>
                        <div className="text-[10px] text-slate-400 font-bold flex items-center gap-2 uppercase tracking-wide mt-1">
                          <span>DUE: {formatDueLabel(item.dueDate)}</span>
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-violet-100 text-violet-600">
                      to-do
                    </span>
                  </div>
                );
              })}
              {pendingTasks === 0 && (
                <div className="text-center py-8 text-slate-500">
                  <CheckCircle size={32} className="mx-auto text-emerald-400 mb-3" />
                  <p>All caught up! Great job.</p>
                </div>
              )}
            </div>
          </div>
      </div>
    </div>
  );
};
