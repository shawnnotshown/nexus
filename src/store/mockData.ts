import { User, Project, Task, Message, Badge } from "../types";

export const mockUsers: User[] = [
  {
    id: "u1",
    name: "Alex Rivera",
    avatar: "https://i.pravatar.cc/150?u=u1",
    xp: 4500,
    level: 12,
    role: "Project Manager",
    badges: [
      { id: "b1", name: "Early Bird", icon: "sun", description: "Completed 10 tasks before 9 AM" },
      { id: "b2", name: "Task Master", icon: "check-circle", description: "Completed 100 tasks" },
    ]
  },
  {
    id: "u2",
    name: "Sarah Chen",
    avatar: "https://i.pravatar.cc/150?u=u2",
    xp: 6200,
    level: 15,
    role: "Lead Developer",
    badges: [
      { id: "b2", name: "Task Master", icon: "check-circle", description: "Completed 100 tasks" },
      { id: "b3", name: "Bug Squasher", icon: "bug", description: "Resolved 50 high priority bugs" },
    ]
  },
  {
    id: "u3",
    name: "Marcus Johnson",
    avatar: "https://i.pravatar.cc/150?u=u3",
    xp: 2100,
    level: 5,
    role: "UI/UX Designer",
    badges: [
      { id: "b4", name: "Pixel Perfect", icon: "palette", description: "Received 20 design approvals" }
    ]
  }
];

export const mockProjects: Project[] = [
  {
    id: "p1",
    name: "Website Redesign",
    description: "Modernizing the corporate website with new branding.",
    progress: 65,
    dueDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString(),
    team: ["u1", "u2", "u3"],
  },
  {
    id: "p2",
    name: "Mobile App V2",
    description: "Adding gamification and real-time features to the mobile app.",
    progress: 20,
    dueDate: new Date(new Date().setMonth(new Date().getMonth() + 3)).toISOString(),
    team: ["u1", "u2"],
  }
];

export const mockTasks: Task[] = [
  {
    id: "t1",
    projectId: "p1",
    title: "Design System Update",
    description: "Update typography and color palette in Figma.",
    status: "in-progress",
    priority: "high",
    assignees: ["u3"],
    dueDate: new Date(new Date().setDate(new Date().getDate() + 2)).toISOString(),
    startDate: new Date(new Date().setDate(new Date().getDate() - 2)).toISOString(),
    completed: false,
    dependencies: [],
    timeTracked: 120,
    subtasks: [
      { id: "st1", title: "Update primary colors", completed: true },
      { id: "st2", title: "Review typography sizing", completed: false },
    ],
    comments: [
      { id: "c1", userId: "u1", content: "Make sure we check contrast ratios.", createdAt: new Date().toISOString() }
    ]
  },
  {
    id: "t2",
    projectId: "p1",
    title: "Implement Auth Flow",
    description: "Setup JWT authentication for the frontend.",
    status: "todo",
    priority: "urgent",
    assignees: ["u2"],
    dueDate: new Date(new Date().setDate(new Date().getDate() + 5)).toISOString(),
    startDate: new Date().toISOString(),
    completed: false,
    dependencies: ["t1"],
    timeTracked: 0,
    subtasks: [],
    comments: []
  },
  {
    id: "t3",
    projectId: "p2",
    title: "Setup WebSockets",
    description: "Implement Socket.io for real-time messaging.",
    status: "done",
    priority: "high",
    assignees: ["u2"],
    dueDate: new Date(new Date().setDate(new Date().getDate() - 1)).toISOString(),
    startDate: new Date(new Date().setDate(new Date().getDate() - 5)).toISOString(),
    completed: true,
    dependencies: [],
    timeTracked: 300,
    subtasks: [],
    comments: []
  }
];

export const mockMessages: Message[] = [
  { id: "m1", channelId: "general", userId: "u1", content: "Welcome to the new workspace!", createdAt: new Date(Date.now() - 3600000).toISOString() },
  { id: "m2", channelId: "general", userId: "u2", content: "Excited to get started.", createdAt: new Date(Date.now() - 3500000).toISOString() },
  { id: "m3", channelId: "general", userId: "u3", content: "I'll share the Figma links shortly.", createdAt: new Date(Date.now() - 3000000).toISOString() },
];
