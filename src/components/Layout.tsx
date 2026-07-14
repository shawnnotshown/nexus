"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SessionNavBar } from "@/components/ui/sidebar";
import { Topbar } from "./Topbar";
import { AuthGate } from "./AuthGate";
import { AppProvider, useAppContext } from "../context/AppContext";
import { AuthProvider } from "../context/AuthContext";
import { WorkspaceProvider } from "../context/WorkspaceContext";
import { UserProfileProvider } from "../context/UserProfileContext";
import { Dashboard } from "../views/Dashboard";
import { Projects } from "../views/Projects";
import { ProjectDetail } from "../views/ProjectDetail";
import { Chat } from "../views/Chat";
import { MyTasks, type MyTasksRowFocus } from "../views/MyTasks";
import { Calendar } from "../views/Calendar";
import { Notes } from "../views/Notes";
import { Settings } from "../views/Settings";
import { useAuth } from "../context/AuthContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { directMessageChannelId } from "../lib/chatChannels";
import type { Message } from "../types";

function toTimestamp(value: string): number {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function LayoutContent() {
  const { messages, currentUser, users } = useAppContext();
  const [currentView, setCurrentView] = useState("dashboard");
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [myTasksRowFocus, setMyTasksRowFocus] = useState<MyTasksRowFocus | null>(null);
  const [chatPreferredChannelId, setChatPreferredChannelId] = useState<string | null>(null);
  const [lastSeenChatAt, setLastSeenChatAt] = useState(0);
  const [chatPopupMessage, setChatPopupMessage] = useState<Message | null>(null);
  const latestMessageIdRef = useRef<string | null>(null);
  const hasInitializedMessageTrackerRef = useRef(false);

  const incomingMessages = useMemo(
    () => messages.filter((message) => message.userId !== currentUser.id),
    [messages, currentUser.id]
  );

  const latestIncomingMessage = useMemo(() => {
    if (incomingMessages.length === 0) return null;
    return incomingMessages.reduce((latest, message) =>
      toTimestamp(message.createdAt) > toTimestamp(latest.createdAt) ? message : latest
    );
  }, [incomingMessages]);

  const hasUnreadChat = useMemo(
    () => incomingMessages.some((message) => toTimestamp(message.createdAt) > lastSeenChatAt),
    [incomingMessages, lastSeenChatAt]
  );

  useEffect(() => {
    if (!latestIncomingMessage) return;

    const latestAt = toTimestamp(latestIncomingMessage.createdAt);
    const previousId = latestMessageIdRef.current;

    if (!hasInitializedMessageTrackerRef.current) {
      hasInitializedMessageTrackerRef.current = true;
      latestMessageIdRef.current = latestIncomingMessage.id;
      // Establish the current latest message as the baseline so historical
      // messages don't appear as unread on first load.
      setLastSeenChatAt(latestAt);
      return;
    }

    if (currentView === "chat") {
      setLastSeenChatAt(latestAt);
      setChatPopupMessage(null);
      latestMessageIdRef.current = latestIncomingMessage.id;
      return;
    }

    if (latestAt <= lastSeenChatAt) return;

    if (previousId === latestIncomingMessage.id) return;

    latestMessageIdRef.current = latestIncomingMessage.id;
    setChatPopupMessage(latestIncomingMessage);
  }, [currentView, lastSeenChatAt, latestIncomingMessage]);

  useEffect(() => {
    if (!chatPopupMessage) return;
    const timeout = window.setTimeout(() => setChatPopupMessage(null), 6000);
    return () => window.clearTimeout(timeout);
  }, [chatPopupMessage]);

  const clearMyTasksRowFocus = useCallback(() => {
    setMyTasksRowFocus(null);
  }, []);

  useEffect(() => {
    if (currentView !== "my-tasks") setMyTasksRowFocus(null);
  }, [currentView]);

  useEffect(() => {
    if (currentView !== "chat") return;
    if (!latestIncomingMessage) return;
    setLastSeenChatAt(toTimestamp(latestIncomingMessage.createdAt));
    setChatPopupMessage(null);
  }, [currentView, latestIncomingMessage]);

  const navigateToProject = (id: string) => {
    setActiveProjectId(id);
    setCurrentView("project-detail");
  };

  const navigateToMyTasks = (focus?: MyTasksRowFocus | null) => {
    setMyTasksRowFocus(focus ?? null);
    setCurrentView("my-tasks");
  };

  const navigateToProjects = () => {
    setCurrentView("projects");
  };

  const popupAuthor = chatPopupMessage
    ? users.find((user) => user.id === chatPopupMessage.userId)
    : null;

  const renderView = () => {
    switch (currentView) {
      case "dashboard":
        return (
          <Dashboard
            onProjectClick={navigateToProject}
            onOpenMyTasks={navigateToMyTasks}
            onViewAllProjects={navigateToProjects}
          />
        );
      case "projects":
        return <Projects onProjectClick={navigateToProject} />;
      case "project-detail":
        return (
          <ProjectDetail projectId={activeProjectId} onBack={() => setCurrentView("projects")} />
        );
      case "chat":
        return <Chat preferredChannelId={chatPreferredChannelId} />;
      case "my-tasks":
        return (
          <MyTasks
            rowFocus={myTasksRowFocus}
            onRowFocusConsumed={clearMyTasksRowFocus}
            extraProjectIds={activeProjectId ? [activeProjectId] : []}
          />
        );
      case "calendar":
        return <Calendar />;
      case "notes":
        return <Notes />;
      case "settings":
        return <Settings />;
      default:
        return (
          <Dashboard
            onProjectClick={navigateToProject}
            onOpenMyTasks={navigateToMyTasks}
            onViewAllProjects={navigateToProjects}
          />
        );
    }
  };

  return (
    <div className="relative flex h-screen overflow-hidden bg-slate-100 font-sans text-foreground select-none">
        <SessionNavBar
          currentView={currentView}
          setCurrentView={setCurrentView}
          hasUnreadChat={hasUnreadChat}
        />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <main
            className={
              currentView === "project-detail" || currentView === "chat"
                ? "min-h-0 flex-1 overflow-auto bg-slate-100 select-text"
                : "min-h-0 flex-1 overflow-auto bg-slate-100 p-6 md:p-8 select-text"
            }
          >
            {currentView === "dashboard" && (
              <Topbar
                onOpenSettings={() => setCurrentView("settings")}
                onNavigateToMyTasks={(focus) => navigateToMyTasks(focus)}
              />
            )}
            {renderView()}
          </main>
        </div>
        {chatPopupMessage && currentView !== "chat" && (
          <button
            type="button"
            onClick={() => {
              setCurrentView("chat");
              setChatPreferredChannelId(directMessageChannelId(currentUser.id, chatPopupMessage.userId));
              setChatPopupMessage(null);
              setLastSeenChatAt(toTimestamp(chatPopupMessage.createdAt));
            }}
            className="fixed bottom-5 right-5 z-40 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-gray-100 bg-white p-4 text-left shadow-sm transition hover:shadow"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-500">New Team Chat Message</p>
            <p className="mt-1 text-sm font-bold text-gray-800 truncate">{popupAuthor?.name ?? "Teammate"}</p>
            <p className="mt-1 text-sm text-gray-600 line-clamp-2">{chatPopupMessage.content}</p>
            <p className="mt-2 text-xs font-semibold text-blue-600">Open chat</p>
          </button>
        )}
    </div>
  );
}

function LayoutShell() {
  return (
    <AppProvider>
      <UserProfileProvider>
        <LayoutContent />
      </UserProfileProvider>
    </AppProvider>
  );
}

function LayoutGate() {
  const { user, loading: authLoading, configError } = useAuth();
  const { workspaceId, ready, error } = useWorkspace();

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-900 font-semibold">
        Loading…
      </div>
    );
  }

  if (!user) {
    return <AuthGate />;
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-900 font-semibold">
        Preparing workspace…
      </div>
    );
  }

  if (error || !workspaceId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center gap-4">
        <p className="text-rose-600 font-semibold max-w-md">{error ?? "No workspace available."}</p>
        {configError && (
          <p className="text-gray-600 text-sm max-w-md">
            Add your Firebase web config to <code className="font-mono">.env.local</code> and restart the dev server.
          </p>
        )}
      </div>
    );
  }

  return <LayoutShell />;
}

export const Layout: React.FC = () => {
  return (
    <AuthProvider>
      <WorkspaceProvider>
        <LayoutGate />
      </WorkspaceProvider>
    </AuthProvider>
  );
};
