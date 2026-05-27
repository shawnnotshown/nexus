import React, { useState, useRef, useEffect, useMemo } from "react";
import { useAppContext } from "../context/AppContext";
import { Send, Hash, Search, MessageCircle, Plus, ChevronDown, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { cn } from "../lib/utils";
import { directMessageChannelId } from "../lib/chatChannels";
import type { ProjectChannel } from "../types";

function getDmPeerUserId(channelId: string, myId: string): string | null {
  if (!channelId.startsWith("dm:")) return null;
  const parts = channelId.split(":");
  if (parts.length !== 3 || parts[0] !== "dm") return null;
  const [, id1, id2] = parts;
  if (id1 === myId) return id2;
  if (id2 === myId) return id1;
  return null;
}

interface ChatProps {
  preferredChannelId?: string | null;
}

export const Chat: React.FC<ChatProps> = ({ preferredChannelId = null }) => {
  const {
    messages,
    currentUser,
    sendMessage,
    users,
    projects,
    projectChannels,
    createSubChannel,
  } = useAppContext();

  const defaultChannelId = useMemo(() => {
    const main = projectChannels.find((ch) => ch.isDefault);
    return main?.id ?? projectChannels[0]?.id ?? "";
  }, [projectChannels]);

  const [activeChannelId, setActiveChannelId] = useState<string>("");
  const [inputVal, setInputVal] = useState("");
  const [collapsedProjects, setCollapsedProjects] = useState<Record<string, boolean>>({});
  const [addingSubForProject, setAddingSubForProject] = useState<string | null>(null);
  const [subChannelName, setSubChannelName] = useState("");
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeChannelId && defaultChannelId) {
      setActiveChannelId(defaultChannelId);
    }
  }, [activeChannelId, defaultChannelId]);

  useEffect(() => {
    if (!preferredChannelId) return;
    if (activeChannelId === preferredChannelId) return;
    setActiveChannelId(preferredChannelId);
  }, [preferredChannelId, activeChannelId]);

  const projectPeerIds = useMemo(() => {
    const ids = new Set<string>();
    for (const p of projects) {
      for (const memberId of p.team) {
        if (memberId !== currentUser.id) ids.add(memberId);
      }
    }
    return ids;
  }, [projects, currentUser.id]);

  const dmPeers = useMemo(
    () => users.filter((u) => projectPeerIds.has(u.id)),
    [users, projectPeerIds]
  );

  const channelsByProject = useMemo(() => {
    const map = new Map<string, ProjectChannel[]>();
    for (const ch of projectChannels) {
      const list = map.get(ch.projectId) ?? [];
      list.push(ch);
      map.set(ch.projectId, list);
    }
    for (const [, list] of map) {
      list.sort((a, b) => {
        if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    }
    return map;
  }, [projectChannels]);

  const activeChannelMessages = messages.filter((m) => m.channelId === activeChannelId);
  const isDm = activeChannelId.startsWith("dm:");
  const dmPeerId = isDm ? getDmPeerUserId(activeChannelId, currentUser.id) : null;
  const dmPeer = dmPeerId ? users.find((u) => u.id === dmPeerId) : undefined;
  const activeChannel = projectChannels.find((c) => c.id === activeChannelId);
  const activeProject = activeChannel
    ? projects.find((p) => p.id === activeChannel.projectId)
    : undefined;
  const headerTitle = isDm
    ? dmPeer?.name ?? "Direct message"
    : activeChannel
      ? activeProject && !activeChannel.isDefault
        ? `${activeProject.name} / ${activeChannel.name}`
        : activeChannel.name
      : "Select a conversation";
  const inputPlaceholder = isDm && dmPeer ? `Message ${dmPeer.name}…` : "Type your message…";

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeChannelId]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputVal.trim() && activeChannelId) {
      void sendMessage(activeChannelId, inputVal.trim());
      setInputVal("");
    }
  };

  const toggleProjectCollapsed = (projectId: string) => {
    setCollapsedProjects((prev) => ({ ...prev, [projectId]: !prev[projectId] }));
  };

  const handleCreateSubChannel = async (projectId: string) => {
    const trimmed = subChannelName.trim();
    if (!trimmed) return;
    await createSubChannel(projectId, trimmed);
    setSubChannelName("");
    setAddingSubForProject(null);
  };

  const renderChannelButton = (ch: ProjectChannel) => {
    const isActive = activeChannelId === ch.id;
    return (
      <button
        key={ch.id}
        type="button"
        onClick={() => setActiveChannelId(ch.id)}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-left cursor-pointer transition-colors",
          isActive ? "bg-indigo-100 text-indigo-700" : "hover:bg-slate-200 text-slate-600"
        )}
      >
        <Hash size={16} className="shrink-0" />
        <span className="truncate text-sm">{ch.isDefault ? "general" : ch.name}</span>
      </button>
    );
  };

  return (
    <div className="flex h-full bg-white rounded-[2.5rem] border border-indigo-50 overflow-hidden shadow-xl shadow-indigo-100/50">
      {/* Sidebar Channels */}
      <div className="w-72 border-r border-indigo-50 bg-indigo-50/30 flex flex-col h-full hidden md:flex">
        <div className="p-6 border-b border-indigo-50">
          <h2 className="font-black text-indigo-900 text-lg">Team Chat</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
            Project channels
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {projects.length === 0 ? (
            <p className="px-2 text-sm text-slate-500">Join or create a project to start chatting.</p>
          ) : (
            projects.map((project) => {
              const channels = channelsByProject.get(project.id) ?? [];
              const collapsed = collapsedProjects[project.id] ?? false;
              const isAddingSub = addingSubForProject === project.id;

              return (
                <div key={project.id} className="mb-2">
                  <button
                    type="button"
                    onClick={() => toggleProjectCollapsed(project.id)}
                    className="w-full flex items-center gap-1 px-2 py-1.5 text-left text-xs font-black text-slate-500 uppercase tracking-wider hover:text-indigo-700"
                  >
                    {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                    <span className="truncate">{project.name}</span>
                  </button>
                  {!collapsed && (
                    <div className="space-y-0.5 pl-1">
                      {channels.length === 0 ? (
                        <p className="px-3 py-1 text-xs text-slate-400">No channels yet</p>
                      ) : (
                        channels.map(renderChannelButton)
                      )}
                      {isAddingSub ? (
                        <form
                          className="px-2 py-1 flex gap-1"
                          onSubmit={(e) => {
                            e.preventDefault();
                            void handleCreateSubChannel(project.id);
                          }}
                        >
                          <input
                            type="text"
                            value={subChannelName}
                            onChange={(e) => setSubChannelName(e.target.value)}
                            placeholder="Subchannel name"
                            className="flex-1 min-w-0 rounded-lg border border-indigo-100 px-2 py-1 text-xs"
                            autoFocus
                          />
                          <button
                            type="submit"
                            disabled={!subChannelName.trim()}
                            className="text-xs font-bold text-indigo-600 disabled:opacity-40"
                          >
                            Add
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setAddingSubForProject(null);
                              setSubChannelName("");
                            }}
                            className="text-xs text-slate-400"
                          >
                            Cancel
                          </button>
                        </form>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setAddingSubForProject(project.id)}
                          className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-600 hover:bg-indigo-50"
                        >
                          <Plus size={14} />
                          Add subchannel
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}

          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-2 mt-6">
            Direct Messages
          </div>
          {dmPeers.length === 0 ? (
            <p className="px-2 text-sm text-slate-500">No teammates on your projects yet.</p>
          ) : (
            dmPeers.map((u) => {
              const dmId = directMessageChannelId(currentUser.id, u.id);
              const isActive = activeChannelId === dmId;
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setActiveChannelId(dmId)}
                  className={cn(
                    "w-full flex items-center gap-2 justify-between px-3 py-2 rounded-lg font-medium group text-left cursor-pointer transition-colors",
                    isActive ? "bg-indigo-100 text-indigo-700" : "hover:bg-slate-200 text-slate-600"
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="relative shrink-0">
                      <img
                        src={u.avatar}
                        className="w-6 h-6 rounded border border-slate-300 object-cover"
                        alt={u.name}
                      />
                      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full" />
                    </div>
                    <span
                      className={cn(
                        "text-sm truncate",
                        isActive ? "text-indigo-800" : "group-hover:text-slate-900"
                      )}
                    >
                      {u.name}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="md:hidden px-3 py-2 border-b border-indigo-100 bg-indigo-50/40">
          <label htmlFor="chat-conversation" className="sr-only">
            Conversation
          </label>
          <select
            id="chat-conversation"
            value={activeChannelId}
            onChange={(e) => setActiveChannelId(e.target.value)}
            className="w-full rounded-xl border border-indigo-100 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 shadow-sm outline-none focus:ring-2 focus:ring-indigo-200"
          >
            {projects.map((project) => {
              const channels = channelsByProject.get(project.id) ?? [];
              if (channels.length === 0) return null;
              return (
                <optgroup key={project.id} label={project.name}>
                  {channels.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      # {ch.isDefault ? "general" : ch.name}
                    </option>
                  ))}
                </optgroup>
              );
            })}
            {dmPeers.length > 0 && (
              <optgroup label="Direct messages">
                {dmPeers.map((u) => (
                  <option key={u.id} value={directMessageChannelId(currentUser.id, u.id)}>
                    {u.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white shadow-sm z-10">
          <div className="flex items-center gap-2 min-w-0">
            {isDm ? (
              <MessageCircle size={20} className="text-slate-400 shrink-0" />
            ) : (
              <Hash size={20} className="text-slate-400 shrink-0" />
            )}
            <h2 className="font-bold text-slate-900 truncate">{headerTitle}</h2>
          </div>
          <div className="text-slate-400 hover:text-slate-600 cursor-pointer">
            <Search size={18} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 bg-indigo-50/50">
          {!activeChannelId ? (
            <p className="text-center text-sm text-slate-500 py-12">
              Select a project channel or direct message to start chatting.
            </p>
          ) : (
            activeChannelMessages.map((msg, i) => {
              const author = users.find((u) => u.id === msg.userId);
              const isMe = msg.userId === currentUser.id;
              const prevMsg = activeChannelMessages[i - 1];
              const isGrouped =
                prevMsg &&
                prevMsg.userId === msg.userId &&
                new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime() < 300000;

              return (
                <div key={msg.id} className={cn("flex w-full", isMe ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "flex max-w-[min(100%,42rem)] gap-3",
                      isMe ? "flex-row-reverse" : "flex-row"
                    )}
                  >
                    {!isMe && !isGrouped && (
                      <img
                        src={author?.avatar}
                        className="h-10 w-10 shrink-0 rounded-full border-2 border-white object-cover shadow-md"
                        alt={author?.name}
                      />
                    )}
                    {!isMe && isGrouped && <div className="w-10 shrink-0" />}

                    <div className={cn("flex min-w-0 flex-col gap-1", isMe ? "items-end" : "items-start")}>
                      {!isGrouped && (
                        <div className="mb-1 flex items-baseline gap-2">
                          <span className="text-xs font-black text-indigo-600">{author?.name}</span>
                          <span className="text-[10px] font-bold text-slate-400">
                            {format(new Date(msg.createdAt), "h:mm a")}
                          </span>
                        </div>
                      )}
                      <div
                        className={cn(
                          "max-w-full break-words px-5 py-3 text-sm font-medium shadow-sm sm:max-w-xl",
                          isMe
                            ? "rounded-[1.5rem] rounded-tr-none bg-indigo-600 text-white shadow-indigo-600/20"
                            : "rounded-[1.5rem] rounded-tl-none border border-slate-100 bg-white text-slate-700"
                        )}
                      >
                        {msg.content}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={endOfMessagesRef} />
        </div>

        <div className="p-6 bg-white border-t border-indigo-50">
          <form onSubmit={handleSend} className="relative">
            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder={inputPlaceholder}
              disabled={!activeChannelId}
              className="w-full pl-6 pr-14 py-4 bg-indigo-50 border-none focus:ring-2 focus:ring-indigo-200 rounded-full outline-none transition-all shadow-inner text-sm font-medium disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!inputVal.trim() || !activeChannelId}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
