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
  onViewAllProjects: () => void;
}> = ({ onProjectClick, onOpenMyTasks, onViewAllProjects }) => {
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
  const completionRate = totalAssigned ? Math.round((completedTasks / totalAssigned) * 100) : 0;

  const myProjectsCount = useMemo(() => {
    const projectSet = new Set<string>();
    myKanbanTasks.forEach((task) => {
      if (task.projectId) projectSet.add(task.projectId);
    });
    assignedTodoRows.forEach((row) => projectSet.add(row.projectId));
    return projectSet.size;
  }, [myKanbanTasks, assignedTodoRows]);

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
  const nearestDueRow = upcomingRows[0];

  const bentoStatCards = [
    { label: "Total Tasks", value: totalAssigned, icon: CheckCircle, color: "text-blue-600", span: "md:col-span-3" },
    { label: "Completed", value: completedTasks, icon: TrendingUp, color: "text-emerald-600", span: "md:col-span-3" },
    { label: "Pending", value: pendingTasks, icon: Clock, color: "text-amber-600", span: "md:col-span-3" },
    { label: "Urgent", value: urgentTasks, icon: AlertCircle, color: "text-rose-600", span: "md:col-span-3" },
  ] as const;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-indigo-900 tracking-tight">Welcome back, {currentUser.name.split(' ')[0]} 👋</h1>
          <p className="text-slate-500 mt-1 font-medium">Here's what's happening with your projects today.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {bentoStatCards.map((stat, i) => (
          <div
            key={i}
            className={`bg-white p-5 rounded-[2rem] border border-indigo-50 shadow-xl shadow-indigo-100/40 flex items-center gap-4 hover:shadow-indigo-100/80 transition-shadow ${stat.span}`}
          >
            <div className={stat.color}>
              <stat.icon size={24} />
            </div>
            <div>
              <div className="text-2xl font-black text-indigo-900">{stat.value}</div>
              <div className="text-sm font-medium text-slate-500">{stat.label}</div>
            </div>
          </div>
        ))}

        <div className="bg-white p-6 rounded-[2rem] border border-indigo-50 shadow-xl shadow-indigo-100/40 md:col-span-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-wide text-indigo-500">Completion Rate</h3>
            <span className="text-xs font-semibold text-slate-500">{myProjectsCount} active projects</span>
          </div>
          <p className="text-4xl font-black text-indigo-900 mt-3">{completionRate}%</p>
          <p className="text-sm text-slate-500 mt-1">Across your assigned kanban + to-do work.</p>
          <div className="mt-4">
            <WorkProgressBar
              label="Progress"
              percent={completionRate}
              trackClassName="bg-slate-200"
            />
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-indigo-50 shadow-xl shadow-indigo-100/40 md:col-span-6">
          <h3 className="text-sm font-black uppercase tracking-wide text-indigo-500">Next Deadline</h3>
          {nearestDueRow ? (
            <div className="mt-4 space-y-2">
              <p className="text-lg font-bold text-indigo-900">
                {nearestDueRow.kind === "kanban" ? nearestDueRow.task.title : nearestDueRow.item.title}
              </p>
              <p className="text-sm text-slate-500">
                Due {formatDueLabel(nearestDueRow.kind === "kanban" ? nearestDueRow.task.dueDate : nearestDueRow.item.dueDate)}
              </p>
              <button
                type="button"
                onClick={() =>
                  nearestDueRow.kind === "kanban"
                    ? onOpenMyTasks({ kind: "kanban", taskId: nearestDueRow.task.id })
                    : onOpenMyTasks({
                        kind: "todo",
                        projectId: nearestDueRow.projectId,
                        itemId: nearestDueRow.item.id,
                      })
                }
                className="mt-2 bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider hover:bg-indigo-200"
              >
                Open Task
              </button>
            </div>
          ) : (
            <div className="mt-4 text-slate-500 text-sm">No upcoming deadlines right now.</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pb-8">
          {/* Active Projects */}
          <div className="bg-white rounded-[2.5rem] border border-indigo-50 shadow-xl shadow-indigo-100/50 p-8 md:col-span-7">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-indigo-900">Active Projects</h2>
              <button
                type="button"
                onClick={onViewAllProjects}
                className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider hover:bg-indigo-200"
              >
                View All
              </button>
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
          <div className="bg-white rounded-[2.5rem] border border-indigo-50 shadow-xl shadow-indigo-100/50 p-8 md:col-span-5">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-indigo-900">My Upcoming Tasks</h2>
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

          <div className="bg-gradient-to-br from-indigo-600 via-indigo-500 to-violet-500 rounded-[2.5rem] shadow-xl shadow-indigo-200/50 p-8 text-white md:col-span-12">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] font-bold text-indigo-100">Quick Actions</p>
                <h3 className="text-2xl font-black mt-2">Keep momentum going today</h3>
                <p className="text-indigo-100 mt-2 text-sm">
                  Jump directly to projects or tasks and keep your sprint moving.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={onViewAllProjects}
                  className="bg-white text-indigo-700 px-4 py-2 rounded-full text-xs font-black uppercase tracking-wide hover:bg-indigo-50"
                >
                  Browse Projects
                </button>
                <button
                  type="button"
                  onClick={() =>
                    nearestDueRow
                      ? nearestDueRow.kind === "kanban"
                        ? onOpenMyTasks({ kind: "kanban", taskId: nearestDueRow.task.id })
                        : onOpenMyTasks({
                            kind: "todo",
                            projectId: nearestDueRow.projectId,
                            itemId: nearestDueRow.item.id,
                          })
                      : onViewAllProjects()
                  }
                  className="bg-indigo-800/40 text-white px-4 py-2 rounded-full text-xs font-black uppercase tracking-wide border border-indigo-200/30 hover:bg-indigo-800/60"
                >
                  View My Tasks
                </button>
              </div>
            </div>
          </div>
      </div>
    </div>
  );
};
