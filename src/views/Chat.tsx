import React, { useState, useRef, useEffect } from "react";
import { useAppContext } from "../context/AppContext";
import { Send, Hash, Search, MessageCircle } from "lucide-react";
import { format } from "date-fns";
import { cn } from "../lib/utils";

const WORKSPACE_CHANNELS = [
  { id: "general", label: "general" },
  { id: "design-updates", label: "design-updates" },
  { id: "feature-requests", label: "feature-requests" },
] as const;

/** Stable thread id for a 1:1 DM (same for both participants). */
function directMessageChannelId(userIdA: string, userIdB: string): string {
  const [first, second] = userIdA.localeCompare(userIdB) <= 0 ? [userIdA, userIdB] : [userIdB, userIdA];
  return `dm:${first}:${second}`;
}

function getDmPeerUserId(channelId: string, myId: string): string | null {
  if (!channelId.startsWith("dm:")) return null;
  const parts = channelId.split(":");
  if (parts.length !== 3 || parts[0] !== "dm") return null;
  const [, id1, id2] = parts;
  if (id1 === myId) return id2;
  if (id2 === myId) return id1;
  return null;
}

export const Chat: React.FC = () => {
  const { messages, currentUser, sendMessage, users } = useAppContext();
  const [activeChannelId, setActiveChannelId] = useState<string>("general");
  const [inputVal, setInputVal] = useState("");
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  const activeChannelMessages = messages.filter((m) => m.channelId === activeChannelId);
  const isDm = activeChannelId.startsWith("dm:");
  const dmPeerId = isDm ? getDmPeerUserId(activeChannelId, currentUser.id) : null;
  const dmPeer = dmPeerId ? users.find((u) => u.id === dmPeerId) : undefined;
  const activeChannelMeta = WORKSPACE_CHANNELS.find((c) => c.id === activeChannelId);
  const headerTitle = isDm ? dmPeer?.name ?? "Direct message" : activeChannelMeta?.label ?? activeChannelId;
  const inputPlaceholder = isDm && dmPeer ? `Message ${dmPeer.name}…` : "Type your message…";

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeChannelId]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputVal.trim()) {
      void sendMessage(activeChannelId, inputVal.trim());
      setInputVal("");
    }
  };

  return (
    <div className="flex h-full bg-white rounded-[2.5rem] border border-indigo-50 overflow-hidden shadow-xl shadow-indigo-100/50">
      {/* Sidebar Channels */}
      <div className="w-72 border-r border-indigo-50 bg-indigo-50/30 flex flex-col h-full hidden md:flex">
        <div className="p-6 border-b border-indigo-50">
          <h2 className="font-black text-indigo-900 text-lg">Workspace</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2 mt-2">Channels</div>
          {WORKSPACE_CHANNELS.map((ch) => {
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
                <Hash size={16} /> {ch.label}
              </button>
            );
          })}
          
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-2 mt-6">Direct Messages</div>
          {users.filter((u) => u.id !== currentUser.id).map((u) => {
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
                    <img src={u.avatar} className="w-6 h-6 rounded border border-slate-300 object-cover" alt={u.name} />
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full" />
                  </div>
                  <span className={cn("text-sm truncate", isActive ? "text-indigo-800" : "group-hover:text-slate-900")}>
                    {u.name}
                  </span>
                </div>
              </button>
            );
          })}
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
            <optgroup label="Channels">
              {WORKSPACE_CHANNELS.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  # {ch.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Direct messages">
              {users
                .filter((u) => u.id !== currentUser.id)
                .map((u) => (
                  <option key={u.id} value={directMessageChannelId(currentUser.id, u.id)}>
                    {u.name}
                  </option>
                ))}
            </optgroup>
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
          {activeChannelMessages.map((msg, i) => {
            const author = users.find((u) => u.id === msg.userId);
            const isMe = msg.userId === currentUser.id;
            const prevMsg = activeChannelMessages[i - 1];
            const isGrouped =
              prevMsg &&
              prevMsg.userId === msg.userId &&
              new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime() < 300000; // 5 mins

            return (
              <div
                key={msg.id}
                className={cn("flex w-full", isMe ? "justify-end" : "justify-start")}
              >
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
          })}
          <div ref={endOfMessagesRef} />
        </div>

        <div className="p-6 bg-white border-t border-indigo-50">
          <form onSubmit={handleSend} className="relative">
            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder={inputPlaceholder}
              className="w-full pl-6 pr-14 py-4 bg-indigo-50 border-none focus:ring-2 focus:ring-indigo-200 rounded-full outline-none transition-all shadow-inner text-sm font-medium"
            />
            <button 
              type="submit" 
              disabled={!inputVal.trim()}
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
