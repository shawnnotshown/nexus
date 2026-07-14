import React, { useMemo } from "react";
import { useAppContext } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { collectUserIdentityIds, isUserAmongAssignees } from "../lib/firestoreMappers";
import { useProjectTodoCountsByProject } from "../hooks/useProjectTodoCountsByProject";
import { WorkProgressBar } from "../components/WorkProgressBar";
import { combinedWorkProgressPercent, kanbanProgressStats } from "../lib/projectProgress";
import { useMyAssignedProjectTodoItems } from "../hooks/useMyAssignedProjectTodoItems";
import { CheckCircle, TrendingUp, Clock, AlertCircle, Calendar } from "lucide-react";
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

const ACTIVE_PROJECTS_LIMIT = 4;
const UPCOMING_TASKS_LIMIT = 5;

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
  const visibleProjects = projects.slice(0, ACTIVE_PROJECTS_LIMIT);
  const visibleUpcomingRows = upcomingRows.slice(0, UPCOMING_TASKS_LIMIT);

  const bentoStatCards = [
    { label: "Total Tasks", value: totalAssigned, icon: CheckCircle, iconBg: "bg-blue-500", span: "md:col-span-3" },
    { label: "Completed", value: completedTasks, icon: TrendingUp, iconBg: "bg-emerald-500", span: "md:col-span-3" },
    { label: "Pending", value: pendingTasks, icon: Clock, iconBg: "bg-amber-500", span: "md:col-span-3" },
    { label: "Urgent", value: urgentTasks, icon: AlertCircle, iconBg: "bg-rose-500", span: "md:col-span-3" },
  ] as const;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pt-14 md:pt-0">
      <div className="hidden md:flex md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Welcome back, {currentUser.name.split(' ')[0]} 👋</h1>
          <p className="text-gray-500 mt-1 font-medium">Here's what's happening with your projects today.</p>
        </div>
      </div>

      <div className="hidden md:grid md:grid-cols-12 gap-4">
        {bentoStatCards.map((stat, i) => (
          <div
            key={i}
            className={`bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 hover:shadow transition-shadow ${stat.span}`}
          >
            <div className={`${stat.iconBg} w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0`}>
              <stat.icon size={22} />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
              <div className="text-sm font-medium text-gray-500">{stat.label}</div>
            </div>
          </div>
        ))}

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm md:col-span-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Completion Rate</h3>
            <span className="text-xs font-semibold text-gray-500">{myProjectsCount} active projects</span>
          </div>
          <p className="text-4xl font-bold text-blue-600 mt-3">{completionRate}%</p>
          <p className="text-sm text-gray-500 mt-1">Across your assigned kanban + to-do work.</p>
          <div className="mt-4">
            <WorkProgressBar
              label="Progress"
              percent={completionRate}
              trackClassName="bg-gray-200"
            />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm md:col-span-6">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Next Deadline</h3>
          {nearestDueRow ? (
            <div className="mt-4 space-y-2">
              <p className="text-lg font-bold text-gray-900">
                {nearestDueRow.kind === "kanban" ? nearestDueRow.task.title : nearestDueRow.item.title}
              </p>
              <p className="text-sm text-gray-500 flex items-center gap-1.5">
                <Calendar size={14} className="text-gray-400" />
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
                className="mt-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
              >
                Open Task
              </button>
            </div>
          ) : (
            <div className="mt-4 text-gray-500 text-sm">No upcoming deadlines right now.</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pb-8">
          {/* Active Projects */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 md:col-span-7">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Active Projects</h2>
              <button
                type="button"
                onClick={onViewAllProjects}
                className="bg-blue-50 text-blue-600 px-3 py-1 rounded-xl text-xs font-semibold uppercase tracking-wider hover:bg-blue-100 transition-colors"
              >
                View All
              </button>
            </div>
            <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
              {visibleProjects.length === 0 ? (
                <p className="text-sm text-gray-500 py-4 text-center">No projects yet.</p>
              ) : (
                visibleProjects.map((project) => {
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
                  className="p-4 rounded-xl border border-gray-100 hover:border-blue-200 hover:shadow-sm transition-all cursor-pointer bg-white group flex items-center gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-800 mb-0.5 group-hover:text-blue-600 truncate">{project.name}</h3>
                    <p className="text-sm text-gray-500 mb-2 line-clamp-1">{project.description}</p>
                    <WorkProgressBar
                      label="Progress "
                      percent={progressPct}
                      trackClassName="bg-gray-200"
                    />
                  </div>
                </div>
                );
              })
              )}
            </div>
          </div>

          {/* Recent Tasks */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 md:col-span-5">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">My Upcoming Tasks</h2>
            </div>
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {visibleUpcomingRows.map((row) => {
                if (row.kind === "kanban") {
                  const task = row.task;
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
                      className="flex items-center justify-between p-4 rounded-xl transition-colors cursor-pointer bg-white border border-gray-100 shadow-sm hover:border-blue-200"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-gray-800 truncate">{task.title}</div>
                        <div className="text-xs text-gray-400 font-medium mt-1">
                          Due: {formatDueLabel(task.dueDate)}
                        </div>
                      </div>
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
                    className="flex items-center justify-between p-4 rounded-xl transition-colors bg-white border border-gray-100 shadow-sm hover:border-blue-200 cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-800 truncate">{item.title}</div>
                      <div className="text-xs text-gray-400 font-medium mt-1">
                        Due: {formatDueLabel(item.dueDate)}
                      </div>
                    </div>
                  </div>
                );
              })}
              {pendingTasks === 0 && visibleUpcomingRows.length === 0 && (
                <div className="text-center py-8 text-gray-500">
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
