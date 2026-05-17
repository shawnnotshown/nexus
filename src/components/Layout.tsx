"use client";

import React, { useCallback, useEffect, useState } from "react";
import { SessionNavBar } from "@/components/ui/sidebar";
import { Topbar } from "./Topbar";
import { AuthGate } from "./AuthGate";
import { AppProvider } from "../context/AppContext";
import { AuthProvider } from "../context/AuthContext";
import { WorkspaceProvider } from "../context/WorkspaceContext";
import { Dashboard } from "../views/Dashboard";
import { Projects } from "../views/Projects";
import { ProjectDetail } from "../views/ProjectDetail";
import { Chat } from "../views/Chat";
import { MyTasks, type MyTasksRowFocus } from "../views/MyTasks";
import { Calendar } from "../views/Calendar";
import { Settings } from "../views/Settings";
import { useAuth } from "../context/AuthContext";
import { useWorkspace } from "../context/WorkspaceContext";

function LayoutShell() {
  const [currentView, setCurrentView] = useState("dashboard");
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [myTasksRowFocus, setMyTasksRowFocus] = useState<MyTasksRowFocus | null>(null);

  const clearMyTasksRowFocus = useCallback(() => {
    setMyTasksRowFocus(null);
  }, []);

  useEffect(() => {
    if (currentView !== "my-tasks") setMyTasksRowFocus(null);
  }, [currentView]);

  const navigateToProject = (id: string) => {
    setActiveProjectId(id);
    setCurrentView("project-detail");
  };

  const navigateToMyTasks = (focus?: MyTasksRowFocus | null) => {
    setMyTasksRowFocus(focus ?? null);
    setCurrentView("my-tasks");
  };

  const renderView = () => {
    switch (currentView) {
      case "dashboard":
        return <Dashboard onProjectClick={navigateToProject} onOpenMyTasks={navigateToMyTasks} />;
      case "projects":
        return <Projects onProjectClick={navigateToProject} />;
      case "project-detail":
        return (
          <ProjectDetail projectId={activeProjectId} onBack={() => setCurrentView("projects")} />
        );
      case "chat":
        return <Chat />;
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
      case "settings":
        return <Settings />;
      default:
        return <Dashboard onProjectClick={navigateToProject} onOpenMyTasks={navigateToMyTasks} />;
    }
  };

  return (
    <AppProvider>
      <div className="relative flex h-screen overflow-hidden bg-slate-100 font-sans text-foreground select-none">
        <SessionNavBar currentView={currentView} setCurrentView={setCurrentView} />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Topbar
            onOpenSettings={() => setCurrentView("settings")}
            onNavigateToMyTasks={(focus) => navigateToMyTasks(focus)}
          />
          <main
            className={
              currentView === "project-detail"
                ? "min-h-0 flex-1 overflow-auto bg-slate-100"
                : "min-h-0 flex-1 overflow-auto bg-slate-100 p-6 md:p-8"
            }
          >
            {renderView()}
          </main>
        </div>
      </div>
    </AppProvider>
  );
}

function LayoutGate() {
  const { user, loading: authLoading, configError } = useAuth();
  const { workspaceId, ready, error } = useWorkspace();

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-indigo-50 text-indigo-900 font-bold">
        Loading…
      </div>
    );
  }

  if (!user) {
    return <AuthGate />;
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-indigo-50 text-indigo-900 font-bold">
        Preparing workspace…
      </div>
    );
  }

  if (error || !workspaceId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-indigo-50 p-6 text-center gap-4">
        <p className="text-rose-600 font-bold max-w-md">{error ?? "No workspace available."}</p>
        {configError && (
          <p className="text-slate-600 text-sm max-w-md">
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
