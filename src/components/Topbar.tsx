"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Bell, Menu, LogOut, Settings as SettingsIcon, AlertCircle, CalendarClock } from "lucide-react";
import { addDays, format, isValid, startOfDay } from "date-fns";
import { useAppContext } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { useMyAssignedProjectTodoItems } from "../hooks/useMyAssignedProjectTodoItems";
import { collectUserIdentityIds, isUserAmongAssignees } from "../lib/firestoreMappers";
import type { ProjectTodoItem, Task } from "../types";
import type { MyTasksRowFocus } from "../views/MyTasks";

interface TopbarProps {
  onOpenSettings?: () => void;
  onNavigateToMyTasks?: (focus: MyTasksRowFocus) => void;
}

type NotifVariant = "overdue" | "dueSoon" | "urgent";

type NotifRow =
  | { key: string; kind: "kanban"; task: Task; variant: NotifVariant; projectName: string }
  | { key: string; kind: "todo"; projectId: string; item: ProjectTodoItem; variant: NotifVariant; projectName: string };

function startOfDueDay(iso: string | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (!isValid(d)) return null;
  return startOfDay(d);
}

export const Topbar: React.FC<TopbarProps> = ({ onOpenSettings, onNavigateToMyTasks }) => {
  const { currentUser, tasks, projects, users } = useAppContext();
  const { workspaceId } = useWorkspace();
  const { signOut, user: authUser } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement | null>(null);
  const notificationsRef = useRef<HTMLDivElement | null>(null);

  const projectIds = useMemo(() => projects.map((p) => p.id), [projects]);
  const projectNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of projects) m.set(p.id, p.name);
    return m;
  }, [projects]);

  const identityIds = useMemo(
    () => collectUserIdentityIds(currentUser.id, authUser?.uid ?? null, users, currentUser.email),
    [currentUser.id, currentUser.email, authUser?.uid, users]
  );
  const { assignedTodoRows } = useMyAssignedProjectTodoItems(workspaceId, identityIds, projectIds);

  const myKanbanTasks = useMemo(
    () => tasks.filter((t) => identityIds.some((id) => isUserAmongAssignees(t.assignees, id))),
    [tasks, identityIds]
  );

  const notificationRows = useMemo((): NotifRow[] => {
    const today = startOfDay(new Date());
    const weekEnd = startOfDay(addDays(today, 7));
    const rows: NotifRow[] = [];

    for (const task of myKanbanTasks) {
      if (task.status === "done") continue;
      const projectName = projectNameById.get(task.projectId) ?? "Project";
      const dueDay = startOfDueDay(task.dueDate);
      let variant: NotifVariant | null = null;
      if (dueDay) {
        if (dueDay < today) variant = "overdue";
        else if (dueDay <= weekEnd) variant = "dueSoon";
      }
      if (!variant && task.priority === "urgent") variant = "urgent";
      if (!variant) continue;
      rows.push({ key: `k:${task.id}`, kind: "kanban", task, variant, projectName });
    }

    for (const { projectId, item } of assignedTodoRows) {
      if (item.completed) continue;
      const projectName = projectNameById.get(projectId) ?? "Project";
      const dueDay = startOfDueDay(item.dueDate);
      let variant: NotifVariant | null = null;
      if (dueDay) {
        if (dueDay < today) variant = "overdue";
        else if (dueDay <= weekEnd) variant = "dueSoon";
      }
      if (!variant) continue;
      rows.push({ key: `t:${projectId}:${item.id}`, kind: "todo", projectId, item, variant, projectName });
    }

    const rank: Record<NotifVariant, number> = { overdue: 0, dueSoon: 1, urgent: 2 };
    rows.sort((a, b) => {
      const vr = rank[a.variant] - rank[b.variant];
      if (vr !== 0) return vr;
      const da =
        a.kind === "kanban" ? startOfDueDay(a.task.dueDate)?.getTime() ?? Infinity : startOfDueDay(a.item.dueDate)?.getTime() ?? Infinity;
      const db =
        b.kind === "kanban" ? startOfDueDay(b.task.dueDate)?.getTime() ?? Infinity : startOfDueDay(b.item.dueDate)?.getTime() ?? Infinity;
      return da - db;
    });

    return rows.slice(0, 20);
  }, [assignedTodoRows, myKanbanTasks, projectNameById]);

  useEffect(() => {
    if (!profileOpen && !notificationsOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (profileRef.current?.contains(target)) return;
      if (notificationsRef.current?.contains(target)) return;
      setProfileOpen(false);
      setNotificationsOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setProfileOpen(false);
        setNotificationsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [profileOpen, notificationsOpen]);

  return (
    <header className="h-20 flex items-center justify-between px-8 bg-white border-b border-indigo-100 sticky top-0 z-20 shadow-sm shadow-indigo-100/20">
      <div className="flex items-center gap-4 flex-1">
        <button className="md:hidden text-indigo-900">
          <Menu size={24} />
        </button>
      </div>

      <div className="flex items-center gap-6">
        <div className="relative" ref={notificationsRef}>
          <button
            type="button"
            onClick={() => {
              setNotificationsOpen((open) => !open);
              setProfileOpen(false);
            }}
            aria-haspopup="menu"
            aria-expanded={notificationsOpen}
            aria-label="Notifications"
            className="relative w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold border-2 border-indigo-200 hover:bg-indigo-200 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:ring-offset-2"
          >
            <Bell size={18} />
            {notificationRows.length > 0 && (
              <span className="absolute top-0 right-0 min-h-2.5 min-w-2.5 px-0.5 rounded-full bg-rose-500 ring-2 ring-white text-[9px] font-black text-white flex items-center justify-center leading-none">
                {notificationRows.length > 9 ? "9+" : notificationRows.length}
              </span>
            )}
          </button>

          {notificationsOpen && (
            <div
              role="menu"
              className="absolute right-0 mt-3 w-80 max-h-[min(24rem,calc(100vh-6rem))] overflow-hidden flex flex-col bg-white rounded-xl shadow-lg shadow-indigo-200/40 border border-indigo-100 z-30"
            >
              <div className="px-4 py-3 border-b border-indigo-50 shrink-0">
                <p className="text-sm font-black text-indigo-900">Notifications</p>
                <p className="text-xs text-slate-500 font-medium mt-0.5">Due dates and urgent work assigned to you</p>
              </div>
              <div className="overflow-y-auto flex-1 py-1">
                {notificationRows.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-slate-500 font-medium">{"You're all caught up."}</p>
                ) : (
                  notificationRows.map((row) => {
                    const title = row.kind === "kanban" ? row.task.title : row.item.title;
                    const dueIso = row.kind === "kanban" ? row.task.dueDate : row.item.dueDate;
                    const dueLabel =
                      dueIso && isValid(new Date(dueIso)) ? format(new Date(dueIso), "MMM d, yyyy") : null;
                    const variantLabel =
                      row.variant === "overdue" ? "Overdue" : row.variant === "dueSoon" ? "Due soon" : "Urgent";
                    const Icon = row.variant === "overdue" ? AlertCircle : CalendarClock;
                    const iconClass =
                      row.variant === "overdue"
                        ? "text-rose-600 bg-rose-50"
                        : row.variant === "dueSoon"
                          ? "text-amber-600 bg-amber-50"
                          : "text-violet-600 bg-violet-50";

                    return (
                      <button
                        key={row.key}
                        type="button"
                        role="menuitem"
                        disabled={!onNavigateToMyTasks}
                        onClick={() => {
                          if (!onNavigateToMyTasks) return;
                          const focus: MyTasksRowFocus =
                            row.kind === "kanban"
                              ? { kind: "kanban", taskId: row.task.id }
                              : { kind: "todo", projectId: row.projectId, itemId: row.item.id };
                          setNotificationsOpen(false);
                          onNavigateToMyTasks(focus);
                        }}
                        className="w-full flex gap-3 px-3 py-2.5 text-left hover:bg-indigo-50/80 transition-colors disabled:opacity-60 disabled:cursor-default border-b border-indigo-50/80 last:border-b-0"
                      >
                        <div className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${iconClass}`}>
                          <Icon size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{variantLabel}</p>
                          <p className="text-sm font-bold text-slate-800 truncate">{title}</p>
                          <p className="text-xs text-slate-500 truncate">{row.projectName}</p>
                          {dueLabel && (
                            <p className="text-xs font-semibold text-slate-500 mt-0.5">Due {dueLabel}</p>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        <div className="relative" ref={profileRef}>
          <button
            type="button"
            onClick={() => {
              setProfileOpen((open) => !open);
              setNotificationsOpen(false);
            }}
            aria-haspopup="menu"
            aria-expanded={profileOpen}
            aria-label="Open profile menu"
            className="block rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:ring-offset-2"
          >
            {currentUser.avatar ? (
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-10 h-10 rounded-full border-2 border-white shadow-md object-cover"
              />
            ) : (
              <div
                className="w-10 h-10 rounded-full border-2 border-white shadow-md bg-indigo-200 text-indigo-900 font-black text-sm flex items-center justify-center"
                aria-hidden
              >
                {(currentUser.name || "?").charAt(0).toUpperCase()}
              </div>
            )}
          </button>

          {profileOpen && (
            <div
              role="menu"
              className="absolute right-0 mt-3 w-56 bg-white rounded-xl shadow-lg shadow-indigo-200/40 border border-indigo-100 overflow-hidden z-30"
            >
              <div className="px-4 py-3 border-b border-indigo-50">
                <p className="text-sm font-bold text-slate-800 truncate">{currentUser.name}</p>
                {currentUser.role && (
                  <p className="text-xs text-slate-500 truncate">{currentUser.role}</p>
                )}
              </div>
              <div className="py-1">
                {onOpenSettings && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setProfileOpen(false);
                      onOpenSettings();
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                  >
                    <SettingsIcon size={16} />
                    Settings
                  </button>
                )}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setProfileOpen(false);
                    void signOut();
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
