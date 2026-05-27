import type { Project, Task } from "../types";

/** Workspace owners see every project; invited members only see projects they are on. */
export function isWorkspaceOwnerRole(role: string | undefined): boolean {
  return role?.trim().toLowerCase() === "owner";
}

export function canUserAccessProject(
  project: Pick<Project, "team">,
  userId: string,
  isWorkspaceOwner: boolean
): boolean {
  if (!userId) return false;
  if (isWorkspaceOwner) return true;
  return project.team.includes(userId);
}

export function filterProjectsForUser(
  projects: Project[],
  userId: string,
  isWorkspaceOwner: boolean
): Project[] {
  if (!userId) return [];
  if (isWorkspaceOwner) return projects;
  return projects.filter((p) => p.team.includes(userId));
}

export function filterTasksForAccessibleProjects(tasks: Task[], accessibleProjectIds: Set<string>): Task[] {
  return tasks.filter((t) => accessibleProjectIds.has(t.projectId));
}
