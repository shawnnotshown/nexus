import { Timestamp } from "firebase/firestore";
import type { Badge, Comment, Message, Priority, Project, ProjectTodoItem, Task, TaskStatus, User } from "../types";

const STATUSES: TaskStatus[] = ["todo", "in-progress", "review", "done"];
const PRIORITIES: Priority[] = ["low", "medium", "high", "urgent"];

/** Normalize Firestore / legacy strings to canonical TaskStatus */
function asTaskStatus(v: unknown): TaskStatus {
  if (typeof v !== "string") return "todo";
  const s = v.trim().toLowerCase().replace(/\s+/g, "-");
  if ((STATUSES as string[]).includes(s)) return s as TaskStatus;
  if (s === "in_progress" || s === "progress" || s === "doing" || s === "active") return "in-progress";
  if (s === "in-review" || s === "in_review" || s === "qa" || s === "testing") return "review";
  if (s === "complete" || s === "closed") return "done";
  if (s === "backlog" || s === "planned") return "todo";
  return "todo";
}

function asPriority(v: unknown): Priority {
  return typeof v === "string" && (PRIORITIES as string[]).includes(v) ? (v as Priority) : "medium";
}

export function toIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === "string") return value;
  return new Date().toISOString();
}

export function memberDocToUser(uid: string, data: Record<string, unknown>): User {
  const badgesRaw = Array.isArray(data.badges) ? data.badges : [];
  const badges: Badge[] = badgesRaw.map((b: Record<string, unknown>) => ({
    id: String(b.id ?? ""),
    name: String(b.name ?? ""),
    icon: String(b.icon ?? "star"),
    description: String(b.description ?? ""),
    unlockedAt: b.unlockedAt != null ? toIso(b.unlockedAt) : undefined,
  }));

  const rawRole = String(data.role ?? "Member");
  const role = rawRole ? rawRole.charAt(0).toUpperCase() + rawRole.slice(1) : "Member";

  const optionalString = (v: unknown): string | undefined => {
    if (typeof v !== "string") return undefined;
    const trimmed = v.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  };

  return {
    id: uid,
    name: String(data.name ?? data.displayName ?? "Member"),
    avatar: String(data.photoURL ?? ""),
    xp: typeof data.xp === "number" ? data.xp : 0,
    level: typeof data.level === "number" ? data.level : 1,
    role,
    badges,
    email: optionalString(data.email),
    title: optionalString(data.title),
    location: optionalString(data.location),
    bio: optionalString(data.bio),
  };
}

export function projectFromFirestore(id: string, data: Record<string, unknown>): Project {
  const team = Array.isArray(data.team) ? (data.team as string[]) : [];
  return {
    id,
    name: String(data.name ?? ""),
    description: String(data.description ?? ""),
    progress: typeof data.progress === "number" ? data.progress : 0,
    dueDate: data.dueDate != null ? toIso(data.dueDate) : undefined,
    team,
  };
}

export function taskFromFirestore(id: string, data: Record<string, unknown>): Task {
  const commentsRaw = Array.isArray(data.comments) ? data.comments : [];
  const comments: Comment[] = commentsRaw.map((c: Record<string, unknown>) => ({
    id: String(c.id ?? ""),
    userId: String(c.userId ?? ""),
    content: String(c.content ?? ""),
    createdAt: toIso(c.createdAt),
  }));

  const subtasksRaw = Array.isArray(data.subtasks) ? data.subtasks : [];
  const subtasks = subtasksRaw.map((s: Record<string, unknown>) => ({
    id: String(s.id ?? ""),
    title: String(s.title ?? ""),
    completed: Boolean(s.completed),
  }));

  const deps = Array.isArray(data.dependencies) ? (data.dependencies as string[]) : [];
  const assignees = Array.isArray(data.assignees) ? (data.assignees as string[]) : [];

  return {
    id,
    projectId: String(data.projectId ?? ""),
    title: String(data.title ?? ""),
    description: String(data.description ?? ""),
    status: asTaskStatus(data.status),
    priority: asPriority(data.priority),
    assignees,
    dueDate: toIso(data.dueDate ?? new Date()),
    startDate: data.startDate != null ? toIso(data.startDate) : undefined,
    completed: Boolean(data.completed),
    comments,
    subtasks,
    dependencies: deps,
    timeTracked: typeof data.timeTracked === "number" ? data.timeTracked : 0,
  };
}

export function messageFromFirestore(id: string, data: Record<string, unknown>): Message {
  return {
    id,
    channelId: String(data.channelId ?? "general"),
    userId: String(data.userId ?? ""),
    content: String(data.content ?? ""),
    createdAt: toIso(data.createdAt),
  };
}

export function projectTodoItemFromFirestore(id: string, data: Record<string, unknown>): ProjectTodoItem {
  const commentsRaw = Array.isArray(data.comments) ? data.comments : [];
  const comments: Comment[] = commentsRaw.map((c: Record<string, unknown>) => ({
    id: String(c.id ?? ""),
    userId: String(c.userId ?? ""),
    content: String(c.content ?? ""),
    createdAt: toIso(c.createdAt),
  }));
  const assignees = Array.isArray(data.assignees) ? (data.assignees as string[]) : [];
  return {
    id,
    listId: String(data.listId ?? ""),
    title: String(data.title ?? ""),
    description: String(data.description ?? ""),
    completed: Boolean(data.completed),
    assignees,
    dueDate: data.dueDate != null ? toIso(data.dueDate) : undefined,
    comments,
  };
}

