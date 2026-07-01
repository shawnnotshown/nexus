"use client";

import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion } from "motion/react";
import { Badge } from "@/components/ui/badge";
import {
  Blocks,
  Calendar,
  CheckSquare,
  ChevronsUpDown,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Menu,
  MessagesSquare,
  NotebookPen,
  Plus,
  Settings,
  UserCircle,
  UserCog,
  X,
} from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/context/AuthContext";
import { useWorkspace } from "@/context/WorkspaceContext";

const sidebarVariants = {
  open: { width: "15rem" },
  closed: { width: "3.05rem" },
};

const contentVariants = {
  open: { display: "block", opacity: 1 },
  closed: { display: "block", opacity: 1 },
};

const labelMotion = {
  open: {
    x: 0,
    opacity: 1,
    transition: { x: { stiffness: 1000, velocity: -100 } },
  },
  closed: {
    x: -20,
    opacity: 0,
    transition: { x: { stiffness: 100 } },
  },
};

const transitionProps = {
  type: "tween" as const,
  ease: "easeOut" as const,
  duration: 0.2,
  staggerChildren: 0.1,
};

const staggerVariants = {
  open: { transition: { staggerChildren: 0.03, delayChildren: 0.02 } },
};

export interface SessionNavBarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
  hasUnreadChat?: boolean;
}

function userInitials(displayName: string | null | undefined, email: string | null | undefined): string {
  if (displayName?.trim()) {
    const parts = displayName.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0]![0] + parts[1]![0]).toUpperCase();
    return displayName.slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return "?";
}

export function SessionNavBar({ currentView, setCurrentView, hasUnreadChat = false }: SessionNavBarProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, signOut } = useAuth();
  const { workspaceId } = useWorkspace();

  const displayName = user?.displayName ?? undefined;
  const email = user?.email ?? undefined;
  const photoURL = user?.photoURL ?? undefined;
  const initials = userInitials(displayName, email);

  const isActive = (id: string) =>
    currentView === id || (id === "projects" && currentView === "project-detail");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => {
      const nextIsMobile = media.matches;
      setIsMobile(nextIsMobile);
      if (!nextIsMobile) setIsMobileMenuOpen(false);
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const shouldShowCollapsed = !isMobile && isCollapsed;

  const handleNavigate = (view: string) => {
    setCurrentView(view);
    if (isMobile) setIsMobileMenuOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsMobileMenuOpen((open) => !open)}
        className="fixed left-3 top-3 z-50 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm md:hidden"
        aria-label={isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
      >
        {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {isMobile && isMobileMenuOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-900/40 md:hidden"
          aria-label="Close navigation overlay"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <motion.div
        className={cn(
          "sidebar h-full shrink-0 self-stretch overflow-hidden border-r border-slate-200 bg-white text-slate-600",
          isMobile
            ? "fixed inset-y-0 left-0 z-50 w-60 shadow-xl md:hidden"
            : "hidden md:block",
        )}
        initial={shouldShowCollapsed ? "closed" : "open"}
        animate={
          isMobile
            ? (isMobileMenuOpen ? { x: 0 } : { x: "-100%" })
            : (shouldShowCollapsed ? "closed" : "open")
        }
        variants={isMobile ? undefined : sidebarVariants}
        transition={transitionProps}
        onMouseEnter={() => {
          if (!isMobile) setIsCollapsed(false);
        }}
        onMouseLeave={() => {
          if (!isMobile) setIsCollapsed(true);
        }}
      >
      <motion.div
        className="relative flex h-full min-h-0 w-full flex-col bg-white transition-all"
        variants={contentVariants}
      >
        <motion.div variants={staggerVariants} className="flex h-full flex-col">
          <div className="flex grow flex-col items-center">
            <div className="flex h-[54px] w-full shrink-0 border-b border-slate-200 p-2">
              <div className="mt-[1.5px] flex w-full">
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger className="w-full" asChild>
                    <Button variant="ghost" size="sm" className="flex w-fit items-center gap-2 px-2">
                      <Avatar className="size-4 rounded-md">
                        <AvatarFallback className="rounded-md text-[10px]">N</AvatarFallback>
                      </Avatar>
                      <motion.span variants={labelMotion} className="flex w-fit items-center gap-2">
                        {!shouldShowCollapsed && (
                          <>
                            <p className="text-sm font-medium text-slate-900">Nexus</p>
                            <ChevronsUpDown className="h-4 w-4 text-slate-400" />
                          </>
                        )}
                      </motion.span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem
                      className="flex cursor-pointer items-center gap-2"
                      onSelect={() => handleNavigate("settings")}
                    >
                      <UserCog className="h-4 w-4" /> Workspace settings
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/join" className="flex cursor-pointer items-center gap-2">
                        <Plus className="h-4 w-4" /> Join with invite
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="flex cursor-pointer items-center gap-2 text-slate-400" disabled>
                      <Blocks className="h-4 w-4" /> Integrations
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="flex h-full w-full flex-col">
              <div className="flex grow flex-col gap-4">
                <ScrollArea className="h-16 grow p-2">
                  <div className="flex w-full flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => handleNavigate("dashboard")}
                      className={cn(
                        "flex h-8 w-full flex-row items-center rounded-md px-2 py-1.5 transition hover:bg-slate-100 hover:text-blue-600",
                        isActive("dashboard") && "bg-slate-100 text-blue-600",
                      )}
                    >
                      <LayoutDashboard className="h-4 w-4 shrink-0" />
                      <motion.span variants={labelMotion} className="min-w-0 text-left">
                        {!shouldShowCollapsed && <p className="ml-2 text-sm font-medium text-slate-900">Dashboard</p>}
                      </motion.span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNavigate("projects")}
                      className={cn(
                        "flex h-8 w-full flex-row items-center rounded-md px-2 py-1.5 transition hover:bg-slate-100 hover:text-blue-600",
                        isActive("projects") && "bg-slate-100 text-blue-600",
                      )}
                    >
                      <FolderKanban className="h-4 w-4 shrink-0" />
                      <motion.span variants={labelMotion} className="min-w-0 text-left">
                        {!shouldShowCollapsed && <p className="ml-2 text-sm font-medium text-slate-900">Projects</p>}
                      </motion.span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNavigate("my-tasks")}
                      className={cn(
                        "flex h-8 w-full flex-row items-center rounded-md px-2 py-1.5 transition hover:bg-slate-100 hover:text-blue-600",
                        isActive("my-tasks") && "bg-slate-100 text-blue-600",
                      )}
                    >
                      <CheckSquare className="h-4 w-4 shrink-0" />
                      <motion.span variants={labelMotion} className="min-w-0 text-left">
                        {!shouldShowCollapsed && <p className="ml-2 text-sm font-medium text-slate-900">My Tasks</p>}
                      </motion.span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNavigate("calendar")}
                      className={cn(
                        "flex h-8 w-full flex-row items-center rounded-md px-2 py-1.5 transition hover:bg-slate-100 hover:text-blue-600",
                        isActive("calendar") && "bg-slate-100 text-blue-600",
                      )}
                    >
                      <Calendar className="h-4 w-4 shrink-0" />
                      <motion.span variants={labelMotion} className="min-w-0 text-left">
                        {!shouldShowCollapsed && <p className="ml-2 text-sm font-medium text-slate-900">Calendar</p>}
                      </motion.span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNavigate("notes")}
                      className={cn(
                        "flex h-8 w-full flex-row items-center rounded-md px-2 py-1.5 transition hover:bg-slate-100 hover:text-blue-600",
                        isActive("notes") && "bg-slate-100 text-blue-600",
                      )}
                    >
                      <NotebookPen className="h-4 w-4 shrink-0" />
                      <motion.span variants={labelMotion} className="min-w-0 text-left">
                        {!shouldShowCollapsed && <p className="ml-2 text-sm font-medium text-slate-900">Notes</p>}
                      </motion.span>
                    </button>
                    <Separator className="w-full" />
                    <button
                      type="button"
                      onClick={() => handleNavigate("chat")}
                      className={cn(
                        "flex h-8 w-full flex-row items-center rounded-md px-2 py-1.5 transition hover:bg-slate-100 hover:text-blue-600",
                        isActive("chat") && "bg-slate-100 text-blue-600",
                      )}
                    >
                      <div className="relative shrink-0">
                        <MessagesSquare className="h-4 w-4" />
                        {hasUnreadChat && (
                          <span
                            className="absolute -right-1.5 -top-1.5 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white"
                            aria-label="Unread chat messages"
                          />
                        )}
                      </div>
                      <motion.span variants={labelMotion} className="min-w-0 text-left">
                        {!shouldShowCollapsed && (
                          <div className="ml-2 flex items-center gap-2">
                            <p className="text-sm font-medium text-slate-900">Team Chat</p>
                            <Badge
                              className="flex h-fit w-fit items-center gap-1.5 rounded border-none bg-blue-50 px-1.5 text-blue-600"
                              variant="outline"
                            >
                              BETA
                            </Badge>
                          </div>
                        )}
                      </motion.span>
                    </button>
                  </div>
                </ScrollArea>
              </div>
              <div className="flex flex-col p-2">
                <button
                  type="button"
                  onClick={() => handleNavigate("settings")}
                  className="mt-auto flex h-8 w-full flex-row items-center rounded-md px-2 py-1.5 transition hover:bg-slate-100 hover:text-blue-600"
                >
                  <Settings className="h-4 w-4 shrink-0" />
                  <motion.span variants={labelMotion} className="min-w-0 text-left">
                    {!shouldShowCollapsed && <p className="ml-2 text-sm font-medium text-slate-900">Settings</p>}
                  </motion.span>
                </button>
                <div>
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger className="w-full">
                      <div className="flex h-8 w-full flex-row items-center gap-2 rounded-md px-2 py-1.5 transition hover:bg-slate-100 hover:text-blue-600">
                        <Avatar className="size-4">
                          {photoURL ? <AvatarImage src={photoURL} alt="" /> : null}
                          <AvatarFallback className="text-[9px]">{initials}</AvatarFallback>
                        </Avatar>
                        <motion.span variants={labelMotion} className="flex min-w-0 flex-1 items-center gap-2">
                          {!shouldShowCollapsed && (
                            <>
                              <p className="truncate text-sm font-medium text-slate-900">
                                {displayName || "Account"}
                              </p>
                              <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 text-slate-400" />
                            </>
                          )}
                        </motion.span>
                      </div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent sideOffset={5} align="start" className="min-w-[12rem]">
                      <div className="flex flex-row items-center gap-2 p-2">
                        <Avatar className="size-6">
                          {photoURL ? <AvatarImage src={photoURL} alt="" /> : null}
                          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                        </Avatar>
                        <div className="flex min-w-0 flex-col text-left">
                          <span className="truncate text-sm font-medium">{displayName || "Signed in"}</span>
                          {email ? (
                            <span className="line-clamp-1 text-xs text-slate-500">{email}</span>
                          ) : null}
                          {workspaceId ? (
                            <span className="mt-0.5 truncate font-mono text-[10px] text-slate-500">
                              {workspaceId}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="flex cursor-pointer items-center gap-2"
                        onSelect={() => handleNavigate("settings")}
                      >
                        <UserCircle className="h-4 w-4" /> Profile & settings
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="flex cursor-pointer items-center gap-2"
                        onSelect={() => {
                          void signOut();
                        }}
                      >
                        <LogOut className="h-4 w-4" /> Sign out
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
      </motion.div>
    </>
  );
}
