import React, { useState, useRef, useEffect, useMemo } from "react";
import { useAppContext } from "../context/AppContext";
import { Send, Hash, Search, Plus, ChevronDown, ChevronRight, X } from "lucide-react";
import { format, formatDistanceToNowStrict } from "date-fns";
import { cn } from "../lib/utils";
import { directMessageChannelId } from "../lib/chatChannels";
import type { ProjectChannel } from "../types";

const QUICK_REACTIONS = ["👍", "❤️", "😂", "🔥", "🎉", "👏"];

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
    toggleMessageReaction,
    users,
    projects,
    projectChannels,
    createSubChannel,
    setTyping,
    typingUsersByChannel,
  } = useAppContext();

  const defaultChannelId = useMemo(() => {
    const main = projectChannels.find((ch) => ch.isDefault);
    return main?.id ?? projectChannels[0]?.id ?? "";
  }, [projectChannels]);

  const [activeChannelId, setActiveChannelId] = useState<string>("");
  const [inputVal, setInputVal] = useState("");
  // Stores an explicit expand/collapse override per project (true = expanded).
  // When absent, a project defaults to expanded only if it's the active one.
  const [projectExpandOverride, setProjectExpandOverride] = useState<Record<string, boolean>>({});
  const [addingSubForProject, setAddingSubForProject] = useState<string | null>(null);
  const [subChannelName, setSubChannelName] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAllDms, setShowAllDms] = useState(false);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  const typingStopTimerRef = useRef<number | null>(null);
  const typingChannelRef = useRef<string>("");
  const typingActiveRef = useRef(false);

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

  // When the active project changes, drop manual expand overrides so the
  // sidebar stays compact (only the active project auto-expands).
  const activeProjectIdForSidebar = useMemo(() => {
    if (!activeChannelId || activeChannelId.startsWith("dm:")) return null;
    return projectChannels.find((c) => c.id === activeChannelId)?.projectId ?? null;
  }, [activeChannelId, projectChannels]);

  useEffect(() => {
    setProjectExpandOverride({});
  }, [activeProjectIdForSidebar]);

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

  const dmChannelsWithHistory = useMemo(() => {
    const set = new Set<string>();
    for (const m of messages) {
      if (m.channelId.startsWith("dm:")) set.add(m.channelId);
    }
    return set;
  }, [messages]);

  const sortedDmPeers = useMemo(() => {
    const latestByChannel = new Map<string, number>();
    for (const m of messages) {
      if (!m.channelId.startsWith("dm:")) continue;
      const t = new Date(m.createdAt).getTime();
      if (Number.isNaN(t)) continue;
      const prev = latestByChannel.get(m.channelId) ?? 0;
      if (t > prev) latestByChannel.set(m.channelId, t);
    }
    return [...dmPeers].sort((a, b) => {
      const dmA = directMessageChannelId(currentUser.id, a.id);
      const dmB = directMessageChannelId(currentUser.id, b.id);
      const ta = latestByChannel.get(dmA) ?? 0;
      const tb = latestByChannel.get(dmB) ?? 0;
      if (tb !== ta) return tb - ta;
      return a.name.localeCompare(b.name);
    });
  }, [dmPeers, messages, currentUser.id]);

  // Peers with an existing conversation (plus the one currently open), so the
  // DM list stays short by default instead of listing every teammate.
  const messagedDmPeers = useMemo(() => {
    return sortedDmPeers.filter((u) => {
      const dmId = directMessageChannelId(currentUser.id, u.id);
      return dmChannelsWithHistory.has(dmId) || dmId === activeChannelId;
    });
  }, [sortedDmPeers, dmChannelsWithHistory, currentUser.id, activeChannelId]);

  const visibleDmPeers = showAllDms ? sortedDmPeers : messagedDmPeers;
  const hiddenDmCount = sortedDmPeers.length - messagedDmPeers.length;

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
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredChannelMessages = useMemo(() => {
    if (!normalizedSearch) return activeChannelMessages;
    return activeChannelMessages.filter((msg) => {
      const authorName = users.find((u) => u.id === msg.userId)?.name?.toLowerCase() ?? "";
      return (
        msg.content.toLowerCase().includes(normalizedSearch) || authorName.includes(normalizedSearch)
      );
    });
  }, [activeChannelMessages, normalizedSearch, users]);
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
  const isUserOnline = (lastSeenAt?: string, isOnline?: boolean): boolean => {
    // Require a fresh lastSeenAt; stale isOnline:true (e.g. after crash) must not win.
    const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;
    const lastSeenMs = lastSeenAt ? new Date(lastSeenAt).getTime() : NaN;
    const ageMs = Number.isNaN(lastSeenMs) ? null : Date.now() - lastSeenMs;
    const isFresh = ageMs != null && ageMs <= ONLINE_THRESHOLD_MS;
    return isOnline === false ? false : isFresh;
  };
  const headerStatusLabel = useMemo(() => {
    if (!isDm || !dmPeer) return "";
    const online = isUserOnline(dmPeer.lastSeenAt, dmPeer.isOnline);
    if (online) return "Online";
    if (dmPeer.lastSeenAt) {
      return `Last seen ${formatDistanceToNowStrict(new Date(dmPeer.lastSeenAt), { addSuffix: true })}`;
    }
    return "Offline";
  }, [isDm, dmPeer]);
  const activeTypingNames = useMemo(() => {
    if (!activeChannelId) return [];
    const typingUserIds = typingUsersByChannel[activeChannelId] ?? [];
    return typingUserIds
      .filter((id) => id !== currentUser.id)
      .map((id) => users.find((u) => u.id === id)?.name)
      .filter((name): name is string => Boolean(name));
  }, [activeChannelId, typingUsersByChannel, users, currentUser.id]);
  const typingLabel = useMemo(() => {
    if (activeTypingNames.length === 0) return "";
    if (activeTypingNames.length === 1) return `${activeTypingNames[0]} is typing`;
    if (activeTypingNames.length === 2) {
      return `${activeTypingNames[0]} and ${activeTypingNames[1]} are typing`;
    }
    return `${activeTypingNames[0]} and ${activeTypingNames.length - 1} others are typing`;
  }, [activeTypingNames]);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeChannelId]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputVal.trim() && activeChannelId) {
      if (typingStopTimerRef.current) window.clearTimeout(typingStopTimerRef.current);
      typingStopTimerRef.current = null;
      if (typingActiveRef.current) {
        void setTyping(activeChannelId, false);
        typingActiveRef.current = false;
      }
      void sendMessage(activeChannelId, inputVal.trim());
      setInputVal("");
    }
  };

  const handleInputChange = (value: string) => {
    setInputVal(value);
    if (!activeChannelId) return;

    if (typingChannelRef.current && typingChannelRef.current !== activeChannelId && typingActiveRef.current) {
      void setTyping(typingChannelRef.current, false);
      typingActiveRef.current = false;
    }
    typingChannelRef.current = activeChannelId;

    const hasContent = value.trim().length > 0;
    if (!hasContent) {
      if (typingStopTimerRef.current) window.clearTimeout(typingStopTimerRef.current);
      typingStopTimerRef.current = null;
      if (typingActiveRef.current) {
        void setTyping(activeChannelId, false);
        typingActiveRef.current = false;
      }
      return;
    }

    if (!typingActiveRef.current) {
      void setTyping(activeChannelId, true);
      typingActiveRef.current = true;
    }

    if (typingStopTimerRef.current) window.clearTimeout(typingStopTimerRef.current);
    typingStopTimerRef.current = window.setTimeout(() => {
      void setTyping(activeChannelId, false);
      typingActiveRef.current = false;
      typingStopTimerRef.current = null;
    }, 1500);
  };

  useEffect(() => {
    if (!activeChannelId) return;
    if (typingChannelRef.current && typingChannelRef.current !== activeChannelId && typingActiveRef.current) {
      void setTyping(typingChannelRef.current, false);
      typingActiveRef.current = false;
    }
    typingChannelRef.current = activeChannelId;
  }, [activeChannelId, setTyping]);

  useEffect(() => {
    return () => {
      if (typingStopTimerRef.current) window.clearTimeout(typingStopTimerRef.current);
      if (typingChannelRef.current && typingActiveRef.current) {
        void setTyping(typingChannelRef.current, false);
      }
    };
  }, [setTyping]);

  const toggleProjectExpanded = (projectId: string, currentlyExpanded: boolean) => {
    setProjectExpandOverride((prev) => ({ ...prev, [projectId]: !currentlyExpanded }));
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
          "w-full flex items-center gap-2 px-2 py-1.5 text-left cursor-pointer text-sm transition-colors",
          isActive
            ? "text-gray-900 font-medium"
            : "text-gray-500 hover:text-gray-900"
        )}
      >
        <Hash size={15} className={cn("shrink-0", isActive ? "text-gray-900" : "text-gray-400")} />
        <span className="truncate">{ch.isDefault ? "general" : ch.name}</span>
      </button>
    );
  };

  return (
    <div className="flex h-full bg-white overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 border-r border-gray-100 bg-white flex-col h-full hidden md:flex">
        <div className="px-5 h-14 flex items-center border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Messages</h2>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {projects.length === 0 ? (
            <p className="px-2 text-sm text-gray-400">Join or create a project to start chatting.</p>
          ) : (
            projects.map((project) => {
              const channels = channelsByProject.get(project.id) ?? [];
              const isActiveProject =
                !isDm && !!activeChannel && activeChannel.projectId === project.id;
              const expanded =
                projectExpandOverride[project.id] ?? isActiveProject;
              const isAddingSub = addingSubForProject === project.id;

              return (
                <div key={project.id}>
                  <div className="flex items-center justify-between group">
                    <button
                      type="button"
                      onClick={() => toggleProjectExpanded(project.id, expanded)}
                      className="flex-1 flex items-center gap-1 px-2 py-1 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-600"
                    >
                      {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      <span className="truncate">{project.name}</span>
                      {!expanded && channels.length > 0 && (
                        <span className="ml-auto text-[10px] font-normal text-gray-300 normal-case tracking-normal">
                          {channels.length}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setProjectExpandOverride((prev) => ({ ...prev, [project.id]: true }));
                        setAddingSubForProject(project.id);
                      }}
                      className="p-1 text-gray-300 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Add subchannel"
                      title="Add subchannel"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  {expanded && (
                    <div className="mt-1 space-y-0.5">
                      {channels.length === 0 ? (
                        <p className="px-2 py-1 text-xs text-gray-300">No channels yet</p>
                      ) : (
                        channels.map(renderChannelButton)
                      )}
                      {isAddingSub && (
                        <form
                          className="px-2 py-1 flex gap-2 items-center"
                          onSubmit={(e) => {
                            e.preventDefault();
                            void handleCreateSubChannel(project.id);
                          }}
                        >
                          <input
                            type="text"
                            value={subChannelName}
                            onChange={(e) => setSubChannelName(e.target.value)}
                            placeholder="new-channel"
                            className="flex-1 min-w-0 border-b border-gray-200 bg-transparent px-1 py-0.5 text-xs outline-none focus:border-gray-900"
                            autoFocus
                          />
                          <button
                            type="submit"
                            disabled={!subChannelName.trim()}
                            className="text-xs font-medium text-gray-900 disabled:opacity-30"
                          >
                            Add
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setAddingSubForProject(null);
                              setSubChannelName("");
                            }}
                            className="text-xs text-gray-400"
                          >
                            Cancel
                          </button>
                        </form>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}

          <div>
            <div className="px-2 py-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              Direct Messages
            </div>
            {dmPeers.length === 0 ? (
              <p className="px-2 py-1 text-xs text-gray-300">No teammates yet.</p>
            ) : visibleDmPeers.length === 0 && !showAllDms ? (
              <div className="mt-1 space-y-1">
                <p className="px-2 py-1 text-xs text-gray-400">No conversations yet.</p>
                {sortedDmPeers.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowAllDms(true)}
                    className="px-2 py-1 text-xs text-gray-500 hover:text-gray-900"
                  >
                    Show all teammates ({sortedDmPeers.length})
                  </button>
                )}
              </div>
            ) : (
              <div className="mt-1 space-y-0.5">
                {visibleDmPeers.map((u) => {
                  const dmId = directMessageChannelId(currentUser.id, u.id);
                  const isActive = activeChannelId === dmId;
                  const online = isUserOnline(u.lastSeenAt, u.isOnline);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => setActiveChannelId(dmId)}
                      className={cn(
                        "w-full flex items-center gap-2 px-2 py-1.5 text-left cursor-pointer text-sm transition-colors",
                        isActive ? "text-gray-900 font-medium" : "text-gray-500 hover:text-gray-900"
                      )}
                    >
                      <span className="relative shrink-0">
                        <img src={u.avatar} className="w-5 h-5 rounded-full object-cover" alt={u.name} />
                        <span
                          className={cn(
                            "absolute -bottom-0.5 -right-0.5 w-2 h-2 border border-white rounded-full",
                            online ? "bg-green-500" : "bg-gray-300"
                          )}
                          title={online ? "Online" : "Offline"}
                        />
                      </span>
                      <span className="truncate">{u.name}</span>
                    </button>
                  );
                })}
                {!showAllDms && hiddenDmCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowAllDms(true)}
                    className="w-full px-2 py-1.5 text-left text-xs text-gray-400 hover:text-gray-900"
                  >
                    Show all teammates ({hiddenDmCount} more)
                  </button>
                )}
                {showAllDms && hiddenDmCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowAllDms(false)}
                    className="w-full px-2 py-1.5 text-left text-xs text-gray-400 hover:text-gray-900"
                  >
                    Show less
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="md:hidden px-3 py-2 border-b border-gray-100">
          <label htmlFor="chat-conversation" className="sr-only">
            Conversation
          </label>
          <select
            id="chat-conversation"
            value={activeChannelId}
            onChange={(e) => setActiveChannelId(e.target.value)}
            className="w-full border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 rounded-lg outline-none focus:border-gray-900"
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
            {sortedDmPeers.length > 0 && (
              <optgroup label="Direct messages">
                {sortedDmPeers.map((u) => (
                  <option key={u.id} value={directMessageChannelId(currentUser.id, u.id)}>
                    {u.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>

        <div className="h-14 px-5 border-b border-gray-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-gray-300 shrink-0">{isDm ? "@" : "#"}</span>
            <h2 className="font-semibold text-gray-900 truncate">{headerTitle}</h2>
            {headerStatusLabel && (
              <span className="flex items-center gap-1.5 text-xs text-gray-400 shrink-0">
                <span
                  className={cn(
                    "inline-block h-1.5 w-1.5 rounded-full",
                    headerStatusLabel === "Online" ? "bg-green-500" : "bg-gray-300"
                  )}
                />
                <span className="truncate">{headerStatusLabel}</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isSearchOpen && (
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search messages..."
                className="w-40 sm:w-56 border-b border-gray-200 bg-transparent px-1 py-1 text-sm text-gray-700 outline-none focus:border-gray-900"
                autoFocus
              />
            )}
            <button
              type="button"
              onClick={() => {
                if (isSearchOpen) setSearchQuery("");
                setIsSearchOpen((prev) => !prev);
              }}
              className="text-gray-400 hover:text-gray-900 cursor-pointer p-1 transition-colors"
              aria-label={isSearchOpen ? "Close search" : "Open search"}
            >
              {isSearchOpen ? <X size={18} /> : <Search size={18} />}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          {!activeChannelId ? (
            <p className="text-center text-sm text-gray-400 py-12">
              Select a project channel or direct message to start chatting.
            </p>
          ) : (
            filteredChannelMessages.map((msg, i) => {
              const author = users.find((u) => u.id === msg.userId);
              const isMe = msg.userId === currentUser.id;
              const reactionEntries = Object.entries(msg.reactions ?? {});
              const prevMsg = filteredChannelMessages[i - 1];
              const isGrouped =
                prevMsg &&
                prevMsg.userId === msg.userId &&
                new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime() < 300000;

              return (
                <div
                  key={msg.id}
                  className={cn(
                    "group relative flex gap-3 px-5 hover:bg-gray-50 transition-colors",
                    isGrouped ? "py-0.5" : "pt-3 pb-0.5"
                  )}
                >
                  <div className="w-8 shrink-0">
                    {!isGrouped ? (
                      <img
                        src={author?.avatar}
                        className="h-8 w-8 rounded-full object-cover"
                        alt={author?.name}
                      />
                    ) : (
                      <span className="hidden group-hover:block text-[10px] text-gray-300 text-right pr-1 pt-1 leading-none">
                        {format(new Date(msg.createdAt), "h:mm")}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    {!isGrouped && (
                      <div className="flex items-baseline gap-2">
                        <span
                          className={cn(
                            "text-sm font-semibold",
                            isMe ? "text-gray-900" : "text-gray-900"
                          )}
                        >
                          {author?.name}
                        </span>
                        <span className="text-[11px] text-gray-400">
                          {format(new Date(msg.createdAt), "h:mm a")}
                        </span>
                      </div>
                    )}
                    <div className="text-sm text-gray-700 whitespace-pre-wrap break-words leading-relaxed">
                      {msg.content}
                    </div>

                    {reactionEntries.length > 0 && (
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        {reactionEntries.map(([emoji, userIds]) => {
                          const safeUserIds = userIds.filter((id) => Boolean(id));
                          if (safeUserIds.length === 0) return null;
                          const reactedByMe = safeUserIds.includes(currentUser.id);
                          return (
                            <button
                              key={`${msg.id}-${emoji}`}
                              type="button"
                              onClick={() => void toggleMessageReaction(msg.id, emoji)}
                              className={cn(
                                "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs transition-colors",
                                reactedByMe
                                  ? "bg-gray-900 text-white"
                                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                              )}
                            >
                              <span>{emoji}</span>
                              <span>{safeUserIds.length}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Hover reaction picker */}
                  <div className="absolute right-4 -top-3 hidden group-hover:flex items-center gap-0.5 rounded-lg border border-gray-100 bg-white px-1 py-0.5 shadow-sm">
                    {QUICK_REACTIONS.map((emoji) => (
                      <button
                        key={`${msg.id}-add-${emoji}`}
                        type="button"
                        onClick={() => void toggleMessageReaction(msg.id, emoji)}
                        className="rounded-md px-1 py-0.5 text-sm hover:bg-gray-100 transition-colors"
                        aria-label={`React with ${emoji}`}
                        title={`React with ${emoji}`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })
          )}
          {activeChannelId && filteredChannelMessages.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-12">No messages match your search.</p>
          )}
          {typingLabel && (
            <div className="flex items-center gap-2 px-5 pt-2 text-xs text-gray-400">
              <span className="inline-flex items-center gap-0.5" aria-hidden="true">
                <span className="h-1.5 w-1.5 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="h-1.5 w-1.5 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="h-1.5 w-1.5 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: "300ms" }} />
              </span>
              <span>{typingLabel}</span>
            </div>
          )}
          <div ref={endOfMessagesRef} />
        </div>

        <div className="px-5 py-4 border-t border-gray-100">
          <form onSubmit={handleSend} className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 focus-within:border-gray-900 transition-colors">
            <input
              type="text"
              value={inputVal}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder={inputPlaceholder}
              disabled={!activeChannelId}
              className="flex-1 bg-transparent py-3 text-sm outline-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!inputVal.trim() || !activeChannelId}
              className="p-1.5 text-gray-400 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Send message"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
