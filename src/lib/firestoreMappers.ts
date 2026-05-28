import { Timestamp } from "firebase/firestore";
import type {
  Badge,
  Comment,
  Message,
  Priority,
  Project,
  ProjectChannel,
  ProjectTodoItem,
  Task,
  TaskStatus,
  User,
} from "../types";

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

/** Coerce Firestore assignees field (array, legacy string, map, or empty) to user id strings. */
export function normalizeAssignees(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .map((entry) => {
        if (typeof entry === "string") return entry.trim();
        if (entry && typeof entry === "object" && "id" in entry) {
          const id = (entry as { id?: unknown }).id;
          return typeof id === "string" ? id.trim() : "";
        }
        return "";
      })
      .filter((id) => id.length > 0);
  }
  if (typeof raw === "string" && raw.trim().length > 0) return [raw.trim()];
  if (raw && typeof raw === "object") {
    return Object.values(raw as Record<string, unknown>)
      .map((v) => (typeof v === "string" ? v.trim() : ""))
      .filter((id) => id.length > 0);
  }
  return [];
}

export function isUserAmongAssignees(assignees: string[], userId: string): boolean {
  if (!userId) return false;
  const target = userId.trim();
  return assignees.some((id) => id.trim() === target);
}

/** All member doc ids that may refer to the signed-in user (uid + same-email aliases). */
export function collectUserIdentityIds(
  userId: string,
  authUid: string | null | undefined,
  users: { id: string; email?: string | null }[],
  currentUserEmail?: string | null
): string[] {
  const ids = new Set<string>();
  if (userId.trim()) ids.add(userId.trim());
  if (authUid?.trim()) ids.add(authUid.trim());
  const email = currentUserEmail?.trim().toLowerCase();
  if (email) {
    for (const u of users) {
      if (u.email?.trim().toLowerCase() === email) ids.add(u.id.trim());
    }
  }
  return Array.from(ids);
}

export function isAssignedToAnyIdentity(assignees: string[], identityIds: string[]): boolean {
  if (identityIds.length === 0) return false;
  const targets = new Set(identityIds.map((id) => id.trim()).filter(Boolean));
  return assignees.some((id) => targets.has(id.trim()));
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
    isOnline: typeof data.isOnline === "boolean" ? data.isOnline : undefined,
    lastSeenAt: data.lastSeenAt != null ? toIso(data.lastSeenAt) : undefined,
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
  const assignees = normalizeAssignees(data.assignees);

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

export function projectChannelFromFirestore(id: string, data: Record<string, unknown>): ProjectChannel {
  return {
    id,
    projectId: String(data.projectId ?? ""),
    name: String(data.name ?? ""),
    isDefault: Boolean(data.isDefault),
    createdAt: data.createdAt != null ? toIso(data.createdAt) : undefined,
    createdBy: typeof data.createdBy === "string" ? data.createdBy : undefined,
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
  let assignees = normalizeAssignees(data.assignees);
  if (assignees.length === 0) {
    assignees = normalizeAssignees(data.assignee);
  }
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

