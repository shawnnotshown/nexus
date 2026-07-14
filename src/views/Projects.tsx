import React, { useMemo, useState } from "react";
import { useAppContext } from "../context/AppContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { useProjectTodoCountsByProject } from "../hooks/useProjectTodoCountsByProject";
import { WorkProgressBar } from "../components/WorkProgressBar";
import { combinedWorkProgressPercent, kanbanProgressStats } from "../lib/projectProgress";
import { FolderKanban, MoreVertical, Calendar, Users, Plus, X, Trash2, Pencil } from "lucide-react";
import { format } from "date-fns";
import { isWorkspaceOwnerRole } from "../lib/projectAccess";
import { UserAvatarButton } from "../components/UserAvatarButton";
import type { Project } from "../types";

export const Projects: React.FC<{ onProjectClick: (id: string) => void }> = ({ onProjectClick }) => {
  const { projects, users, addProject, updateProject, deleteProject, tasks, currentUser } = useAppContext();
  const canManageProjects = isWorkspaceOwnerRole(currentUser.role);
  const { workspaceId } = useWorkspace();
  const projectIds = useMemo(() => projects.map((p) => p.id), [projects]);
  const todoCountsByProject = useProjectTodoCountsByProject(workspaceId, projectIds);
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [newProjectDueDate, setNewProjectDueDate] = useState("");
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editProjectName, setEditProjectName] = useState("");
  const [editProjectDesc, setEditProjectDesc] = useState("");
  const [editProjectDueDate, setEditProjectDueDate] = useState("");
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [editProjectError, setEditProjectError] = useState("");

  const handleCreateProject = () => {
    if (!newProjectName.trim()) return;
    void addProject({
      name: newProjectName,
      description: newProjectDesc || "A new project",
      dueDate: newProjectDueDate ? new Date(`${newProjectDueDate}T23:59:59`).toISOString() : undefined,
      team: [],
      progress: 0,
    });
    setNewProjectName("");
    setNewProjectDesc("");
    setNewProjectDueDate("");
    setIsAddingProject(false);
  };

  const openEditProject = (project: Project) => {
    setEditingProjectId(project.id);
    setEditProjectName(project.name);
    setEditProjectDesc(project.description);
    setEditProjectDueDate(project.dueDate ? format(new Date(project.dueDate), "yyyy-MM-dd") : "");
    setEditProjectError("");
    setActiveDropdown(null);
  };

  const closeEditProject = () => {
    if (isSavingProject) return;
    setEditingProjectId(null);
    setEditProjectError("");
  };

  const handleUpdateProject = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingProjectId || !editProjectName.trim()) return;

    setIsSavingProject(true);
    setEditProjectError("");
    try {
      await updateProject(editingProjectId, {
        name: editProjectName,
        description: editProjectDesc,
        dueDate: editProjectDueDate
          ? new Date(`${editProjectDueDate}T23:59:59`).toISOString()
          : undefined,
      });
      setEditingProjectId(null);
    } catch (error) {
      setEditProjectError(error instanceof Error ? error.message : "Unable to update the project.");
    } finally {
      setIsSavingProject(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-8">
      <div className="flex justify-between items-center relative z-10">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Projects</h1>
          <p className="hidden sm:block text-gray-500 mt-1 font-medium">Manage your team's workspaces and progress.</p>
        </div>
        {canManageProjects && (
          <button
            onClick={() => setIsAddingProject(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white p-3 sm:px-5 sm:py-3 rounded-xl text-sm font-semibold tracking-wide flex items-center gap-2 transition-colors shadow-sm"
          >
            <Plus size={18} className="stroke-[3px]" />
            <span className="hidden sm:inline">New Project</span>
          </button>
        )}
      </div>

      {/* Add Project Inline Form */}
      {isAddingProject && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 transform transition-all relative">
          <button onClick={() => setIsAddingProject(false)} className="absolute top-6 right-6 p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} className="stroke-[3px]" />
          </button>
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <FolderKanban className="text-blue-600" /> Start a New Project
          </h2>
          <div className="space-y-4 max-w-2xl">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Project Name</label>
              <input 
                autoFocus
                type="text" 
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="e.g. Website Redesign"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Description</label>
              <textarea 
                value={newProjectDesc}
                onChange={(e) => setNewProjectDesc(e.target.value)}
                placeholder="What is this project about?"
                rows={2}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all resize-none"
              ></textarea>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Due Date <span className="text-gray-400 normal-case tracking-normal">(optional)</span></label>
              <input
                type="date"
                value={newProjectDueDate}
                onChange={(e) => setNewProjectDueDate(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              />
            </div>
            <button 
              onClick={handleCreateProject}
              disabled={!newProjectName.trim()}
              className="mt-4 bg-blue-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-sm"
            >
              Create Project
            </button>
          </div>
        </div>
      )}

      {editingProjectId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/40 p-4"
          onClick={closeEditProject}
        >
          <form
            onSubmit={handleUpdateProject}
            onClick={(event) => event.stopPropagation()}
            className="relative w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl sm:p-8"
          >
            <button
              type="button"
              onClick={closeEditProject}
              disabled={isSavingProject}
              className="absolute right-5 top-5 rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
              aria-label="Close edit project"
            >
              <X size={20} />
            </button>
            <h2 className="mb-6 flex items-center gap-2 text-xl font-bold text-gray-900">
              <Pencil className="text-blue-600" size={22} /> Edit Project
            </h2>
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">Project Name</label>
                <input
                  autoFocus
                  type="text"
                  value={editProjectName}
                  onChange={(event) => setEditProjectName(event.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 font-semibold text-gray-800 transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">Description</label>
                <textarea
                  value={editProjectDesc}
                  onChange={(event) => setEditProjectDesc(event.target.value)}
                  rows={4}
                  className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 font-medium text-gray-800 transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Deadline <span className="normal-case tracking-normal text-gray-400">(optional)</span>
                </label>
                <input
                  type="date"
                  value={editProjectDueDate}
                  onChange={(event) => setEditProjectDueDate(event.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 font-semibold text-gray-800 transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {editProjectError && <p className="text-sm font-medium text-rose-600">{editProjectError}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeEditProject}
                  disabled={isSavingProject}
                  className="rounded-xl px-5 py-3 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!editProjectName.trim() || isSavingProject}
                  className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSavingProject ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-12" onClick={() => setActiveDropdown(null)}>
        {projects.map(project => {
          const team = users.filter(u => project.team.includes(u.id));
          const projectTasks = tasks.filter((t) => t.projectId === project.id);
          const kanban = kanbanProgressStats(projectTasks);
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
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 hover:shadow transition-shadow cursor-pointer group relative"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors truncate min-w-0">
                  {project.name}
                </h3>
                <div className="relative shrink-0">
                  <button 
                    className="text-gray-400 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100 transition-colors" 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      setActiveDropdown(activeDropdown === project.id ? null : project.id); 
                    }}
                  >
                    <MoreVertical size={20} />
                  </button>
                  {canManageProjects && activeDropdown === project.id && (
                    <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-sm border border-gray-100 p-2 z-20" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => openEditProject(project)}
                        className="w-full text-left px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"
                      >
                        <Pencil size={16} /> Edit Project
                      </button>
                      <button
                        onClick={() => {
                          if (deleteProject) void deleteProject(project.id);
                          setActiveDropdown(null);
                        }}
                        className="w-full text-left px-4 py-2.5 rounded-xl text-sm font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors"
                      >
                        <Trash2 size={16} /> Delete Project
                      </button>
                    </div>
                  )}
                </div>
              </div>
              
              <p className="text-sm text-gray-500 mb-6 line-clamp-2">{project.description}</p>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1.5 text-gray-600">
                    <Calendar size={16} />
                    <span>{project.dueDate ? format(new Date(project.dueDate), 'MMM d, yyyy') : "No due date"}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-gray-600">
                    <Users size={16} />
                    <span>{project.team.length}</span>
                  </div>
                </div>

                <WorkProgressBar
                  label="Progress "
                  percent={progressPct}
                  trackClassName="bg-gray-200"
                />

                <div className="flex -space-x-2 pt-2">
                  {team.map((member, i) => (
                    <UserAvatarButton
                      key={member.id}
                      user={member}
                      imgClassName="w-8 h-8 border-2 border-white bg-gray-200"
                      style={{ zIndex: team.length - i }}
                      className="relative"
                    />
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
