import React, { useMemo, useState } from "react";
import { useAppContext } from "../context/AppContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { useProjectTodoCountsByProject } from "../hooks/useProjectTodoCountsByProject";
import { WorkProgressBar } from "../components/WorkProgressBar";
import { combinedWorkProgressPercent, kanbanProgressStats } from "../lib/projectProgress";
import { FolderKanban, MoreVertical, Calendar, Users, Plus, X, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { isWorkspaceOwnerRole } from "../lib/projectAccess";

export const Projects: React.FC<{ onProjectClick: (id: string) => void }> = ({ onProjectClick }) => {
  const { projects, users, addProject, deleteProject, tasks, currentUser } = useAppContext();
  const canManageProjects = isWorkspaceOwnerRole(currentUser.role);
  const { workspaceId } = useWorkspace();
  const projectIds = useMemo(() => projects.map((p) => p.id), [projects]);
  const todoCountsByProject = useProjectTodoCountsByProject(workspaceId, projectIds);
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [newProjectDueDate, setNewProjectDueDate] = useState("");
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

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

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-8">
      <div className="flex justify-between items-center relative z-10">
        <div>
          <h1 className="text-3xl font-black text-indigo-900 tracking-tight">Projects</h1>
          <p className="text-slate-500 mt-1 font-medium">Manage your team's workspaces and progress.</p>
        </div>
        {canManageProjects && (
          <button
            onClick={() => setIsAddingProject(true)}
            className="bg-rose-500 hover:bg-rose-600 text-white px-5 py-3 rounded-[1.5rem] text-sm font-black tracking-wide flex items-center gap-2 transition-transform hover:scale-105 shadow-xl shadow-rose-200 uppercase"
          >
            <Plus size={18} className="stroke-[3px]" />
            <span>New Project</span>
          </button>
        )}
      </div>

      {/* Add Project Inline Form */}
      {isAddingProject && (
        <div className="bg-white rounded-[2.5rem] border border-indigo-100 shadow-2xl shadow-indigo-100 p-8 transform transition-all relative">
          <button onClick={() => setIsAddingProject(false)} className="absolute top-6 right-6 p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} className="stroke-[3px]" />
          </button>
          <h2 className="text-xl font-bold text-indigo-900 mb-6 flex items-center gap-2">
            <FolderKanban className="text-indigo-500" /> Start a New Project
          </h2>
          <div className="space-y-4 max-w-2xl">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Project Name</label>
              <input 
                autoFocus
                type="text" 
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="e.g. Website Redesign"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all shadow-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Description</label>
              <textarea 
                value={newProjectDesc}
                onChange={(e) => setNewProjectDesc(e.target.value)}
                placeholder="What is this project about?"
                rows={2}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all shadow-sm resize-none"
              ></textarea>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Due Date <span className="text-slate-400 normal-case tracking-normal">(optional)</span></label>
              <input
                type="date"
                value={newProjectDueDate}
                onChange={(e) => setNewProjectDueDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all shadow-sm"
              />
            </div>
            <button 
              onClick={handleCreateProject}
              disabled={!newProjectName.trim()}
              className="mt-4 bg-indigo-600 text-white font-bold px-6 py-3 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-md shadow-indigo-200"
            >
              Create Project
            </button>
          </div>
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
              className="bg-white rounded-[2.5rem] border border-indigo-50 shadow-xl shadow-indigo-100/40 p-8 hover:-translate-y-1 transition-transform cursor-pointer group relative"
            >
              <div className="flex justify-between items-start mb-4 relative z-0">
                <div className="bg-indigo-50 p-3 rounded-xl text-indigo-600">
                  <FolderKanban size={24} />
                </div>
                <div className="relative">
                  <button 
                    className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors" 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      setActiveDropdown(activeDropdown === project.id ? null : project.id); 
                    }}
                  >
                    <MoreVertical size={20} />
                  </button>
                  {canManageProjects && activeDropdown === project.id && (
                    <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-2xl shadow-xl shadow-indigo-100/50 border border-slate-100 p-2 z-20" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => {
                          if (deleteProject) void deleteProject(project.id);
                          setActiveDropdown(null);
                        }}
                        className="w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors"
                      >
                        <Trash2 size={16} /> Delete Project
                      </button>
                    </div>
                  )}
                </div>
              </div>
              
              <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-indigo-600 transition-colors">{project.name}</h3>
              <p className="text-sm text-slate-500 mb-6 line-clamp-2">{project.description}</p>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <Calendar size={16} />
                    <span>{project.dueDate ? format(new Date(project.dueDate), 'MMM d, yyyy') : "No due date"}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <Users size={16} />
                    <span>{project.team.length}</span>
                  </div>
                </div>

                <WorkProgressBar
                  label="Progress "
                  percent={progressPct}
                  trackClassName="bg-slate-200"
                />

                <div className="flex -space-x-2 pt-2">
                  {team.map((member, i) => (
                    <img 
                      key={member.id}
                      src={member.avatar} 
                      alt={member.name}
                      className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 object-cover"
                      style={{ zIndex: team.length - i }}
                      title={member.name}
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
