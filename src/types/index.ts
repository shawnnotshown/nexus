export type Priority = "low" | "medium" | "high" | "urgent";
export type TaskStatus = "todo" | "in-progress" | "review" | "done";

export interface User {
  id: string;
  name: string;
  avatar: string;
  xp: number;
  level: number;
  badges: Badge[];
  role: string;
  email?: string;
  title?: string;
  location?: string;
  bio?: string;
  isOnline?: boolean;
  lastSeenAt?: string;
}

export interface Badge {
  id: string;
  name: string;
  icon: string;
  description: string;
  unlockedAt?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  progress: number;
  dueDate?: string;
  team: string[]; // User IDs
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  assignees: string[]; // User IDs
  dueDate: string;
  startDate?: string;
  completed: boolean;
  comments: Comment[];
  subtasks: Subtask[];
  dependencies: string[]; // Task IDs
  timeTracked: number; // in minutes
}

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Comment {
  id: string;
  userId: string;
  content: string;
  createdAt: string;
}

export interface Message {
  id: string;
  channelId: string;
  userId: string;
  content: string;
  createdAt: string;
  reactions?: Record<string, string[]>;
}

/** Project-scoped team chat channel (main or subchannel). */
export interface ProjectChannel {
  id: string;
  projectId: string;
  name: string;
  isDefault: boolean;
  createdAt?: string;
  createdBy?: string;
}

/** Project hub — Firestore + Storage backed */
export interface ProjectBoardThread {
  id: string;
  title: string;
  content: string;
  userId: string;
  createdAt: string;
  commentCount: number;
}

export interface ProjectBoardComment {
  id: string;
  userId: string;
  content: string;
  createdAt: string;
}

export interface ProjectTodoItem {
  id: string;
  listId: string;
  title: string;
  description: string;
  status: TaskStatus;
  completed: boolean;
  assignees: string[];
  dueDate?: string;
  comments: Comment[];
}

export interface ProjectTodoList {
  id: string;
  name: string;
  order: number;
  tasks: ProjectTodoItem[];
}

export interface ProjectScheduleEvent {
  id: string;
  title: string;
  notes: string;
  eventDate: string;
  createdBy: string;
  reminderSentAt?: string;
}

export interface ProjectFileMeta {
  id: string;
  name: string;
  storagePath: string;
  downloadURL: string;
  contentType: string;
  size: number;
  uploadedAt: string;
  uploadedBy: string;
}

/** Personal note stored under users/{userId}/notes/{noteId} */
export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}
