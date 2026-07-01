"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Italic,
  List,
  ListOrdered,
  NotebookPen,
  Plus,
  Quote,
  Redo,
  Search,
  Strikethrough,
  Trash2,
  Underline as UnderlineIcon,
  Undo,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "../context/AuthContext";
import { useNotes } from "../hooks/useNotes";
import type { Note } from "../types";
import { cn } from "@/lib/utils";

function extractTextPreview(content: string, maxLength = 80): string {
  if (!content.trim()) return "No content";
  try {
    const doc = JSON.parse(content) as { content?: Array<{ content?: Array<{ text?: string }> }> };
    const parts: string[] = [];
    const walk = (nodes: unknown): void => {
      if (!Array.isArray(nodes)) return;
      for (const node of nodes) {
        if (typeof node !== "object" || node === null) continue;
        const n = node as { text?: string; content?: unknown };
        if (typeof n.text === "string") parts.push(n.text);
        if (n.content) walk(n.content);
      }
    };
    walk(doc.content);
    const text = parts.join(" ").trim();
    if (!text) return "No content";
    return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
  } catch {
    return "No content";
  }
}

function DeleteNoteConfirmModal({
  note,
  deleting,
  onCancel,
  onConfirm,
}: {
  note: Note;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !deleting) onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deleting, onCancel]);

  const title = note.title.trim() || "Untitled";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40"
        aria-label="Close delete confirmation"
        onClick={() => {
          if (!deleting) onCancel();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-note-title"
        className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
      >
        <h2 id="delete-note-title" className="text-lg font-bold text-slate-900">
          Delete note?
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          <span className="font-semibold text-slate-800">&ldquo;{title}&rdquo;</span> will be
          permanently deleted. This cannot be undone.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            disabled={deleting}
            onClick={onCancel}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={onConfirm}
            className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40",
        active && "bg-blue-50 text-blue-600"
      )}
    >
      {children}
    </button>
  );
}

function NoteEditor({
  note,
  onSave,
}: {
  note: Note;
  onSave: (updates: Partial<Pick<Note, "title" | "content">>) => void;
}) {
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [title, setTitle] = useState(note.title);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const noteIdRef = useRef(note.id);

  const scheduleSave = useCallback(
    (updates: Partial<Pick<Note, "title" | "content">>) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      setSaveState("saving");
      saveTimeoutRef.current = setTimeout(() => {
        onSave(updates);
        setSaveState("saved");
        window.setTimeout(() => setSaveState("idle"), 1500);
      }, 1000);
    },
    [onSave]
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Highlight,
      Placeholder.configure({
        placeholder: "Start writing your note…",
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
    ],
    content: JSON.parse(note.content || '{"type":"doc","content":[{"type":"paragraph"}]}'),
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "notes-editor-content min-h-[320px] outline-none",
      },
    },
    onUpdate: ({ editor: ed }) => {
      scheduleSave({ content: JSON.stringify(ed.getJSON()) });
    },
  });

  useEffect(() => {
    if (noteIdRef.current !== note.id) {
      noteIdRef.current = note.id;
      setTitle(note.title);
      if (editor) {
        try {
          editor.commands.setContent(JSON.parse(note.content), { emitUpdate: false });
        } catch {
          editor.commands.setContent({ type: "doc", content: [{ type: "paragraph" }] }, { emitUpdate: false });
        }
      }
    }
  }, [note.id, note.title, note.content, editor]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (titleTimeoutRef.current) clearTimeout(titleTimeoutRef.current);
    };
  }, []);

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (titleTimeoutRef.current) clearTimeout(titleTimeoutRef.current);
    setSaveState("saving");
    titleTimeoutRef.current = setTimeout(() => {
      onSave({ title: value.trim() || "Untitled" });
      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 1500);
    }, 500);
  };

  if (!editor) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
        Loading editor…
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <input
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Note title"
          className="min-w-0 flex-1 bg-transparent text-xl font-bold text-slate-900 outline-none placeholder:text-slate-400"
        />
        <span className="ml-4 shrink-0 text-xs font-medium text-slate-400">
          {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : ""}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 px-2 py-1.5">
        <ToolbarButton
          title="Bold"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Italic"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Underline"
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Strikethrough"
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Highlight"
          active={editor.isActive("highlight")}
          onClick={() => editor.chain().focus().toggleHighlight().run()}
        >
          <Highlighter className="h-4 w-4" />
        </ToolbarButton>

        <span className="mx-1 h-5 w-px bg-slate-200" />

        <ToolbarButton
          title="Heading 1"
          active={editor.isActive("heading", { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        >
          <Heading1 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Heading 2"
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Heading 3"
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 className="h-4 w-4" />
        </ToolbarButton>

        <span className="mx-1 h-5 w-px bg-slate-200" />

        <ToolbarButton
          title="Bullet list"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Ordered list"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Blockquote"
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Code block"
          active={editor.isActive("codeBlock")}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        >
          <Code className="h-4 w-4" />
        </ToolbarButton>

        <span className="mx-1 h-5 w-px bg-slate-200" />

        <ToolbarButton
          title="Align left"
          active={editor.isActive({ textAlign: "left" })}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
        >
          <AlignLeft className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Align center"
          active={editor.isActive({ textAlign: "center" })}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
        >
          <AlignCenter className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Align right"
          active={editor.isActive({ textAlign: "right" })}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
        >
          <AlignRight className="h-4 w-4" />
        </ToolbarButton>

        <span className="mx-1 h-5 w-px bg-slate-200" />

        <ToolbarButton
          title="Undo"
          disabled={!editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Redo"
          disabled={!editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo className="h-4 w-4" />
        </ToolbarButton>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-6 py-4">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

export const Notes: React.FC = () => {
  const { user } = useAuth();
  const { notes, loading, createNote, updateNote, deleteNote } = useNotes(user?.uid);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filteredNotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter(
      (note) =>
        note.title.toLowerCase().includes(q) ||
        extractTextPreview(note.content, 500).toLowerCase().includes(q)
    );
  }, [notes, searchQuery]);

  const selectedNote = useMemo(
    () => notes.find((note) => note.id === selectedNoteId) ?? null,
    [notes, selectedNoteId]
  );

  useEffect(() => {
    if (selectedNoteId && !notes.some((note) => note.id === selectedNoteId)) {
      setSelectedNoteId(notes[0]?.id ?? null);
    }
  }, [notes, selectedNoteId]);

  const handleCreateNote = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const id = await createNote();
      if (id) setSelectedNoteId(id);
    } finally {
      setCreating(false);
    }
  };

  const handleConfirmDeleteNote = async () => {
    if (!noteToDelete || deleting) return;

    const noteId = noteToDelete.id;
    setDeleting(true);
    try {
      const remaining = notes.filter((note) => note.id !== noteId);
      if (selectedNoteId === noteId) {
        setSelectedNoteId(remaining[0]?.id ?? null);
      }
      await deleteNote(noteId);
      setNoteToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleSave = useCallback(
    (updates: Partial<Pick<Note, "title" | "content">>) => {
      if (!selectedNoteId) return;
      void updateNote(selectedNoteId, updates);
    },
    [selectedNoteId, updateNote]
  );

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-4 md:h-[calc(100vh-5rem)]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Notes</h1>
          <p className="text-sm text-slate-500">Personal notes — only visible to you.</p>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <aside className="flex w-full max-w-xs shrink-0 flex-col border-r border-slate-200 md:max-w-sm">
          <div className="space-y-3 border-b border-slate-200 p-3">
            <button
              type="button"
              onClick={() => void handleCreateNote()}
              disabled={creating}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              {creating ? "Creating…" : "New Note"}
            </button>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search notes…"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto p-2">
            {loading ? (
              <p className="px-2 py-4 text-center text-sm text-slate-500">Loading notes…</p>
            ) : filteredNotes.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <NotebookPen className="h-8 w-8 text-slate-300" />
                <p className="text-sm font-medium text-slate-600">
                  {searchQuery.trim() ? "No matching notes" : "No notes yet"}
                </p>
                {!searchQuery.trim() && (
                  <button
                    type="button"
                    onClick={() => void handleCreateNote()}
                    className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                  >
                    Create your first note
                  </button>
                )}
              </div>
            ) : (
              <ul className="space-y-1">
                {filteredNotes.map((note) => {
                  const isSelected = note.id === selectedNoteId;
                  return (
                    <li key={note.id}>
                      <div
                        className={cn(
                          "group flex items-start gap-1 rounded-lg border transition",
                          isSelected
                            ? "border-blue-200 bg-blue-50"
                            : "border-transparent hover:border-slate-200 hover:bg-slate-50"
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedNoteId(note.id)}
                          className="min-w-0 flex-1 px-3 py-2.5 text-left"
                        >
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {note.title.trim() || "Untitled"}
                          </p>
                          <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
                            {extractTextPreview(note.content)}
                          </p>
                          <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                            {formatDistanceToNow(new Date(note.updatedAt), { addSuffix: true })}
                          </p>
                        </button>
                        <button
                          type="button"
                          title="Delete note"
                          onClick={() => setNoteToDelete(note)}
                          className="mr-1 mt-2 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 opacity-0 transition hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        <section className="hidden min-w-0 flex-1 flex-col md:flex">
          {selectedNote ? (
            <NoteEditor key={selectedNote.id} note={selectedNote} onSave={handleSave} />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <NotebookPen className="h-12 w-12 text-slate-300" />
              <p className="text-lg font-semibold text-slate-700">Select a note to edit</p>
              <p className="max-w-sm text-sm text-slate-500">
                Choose a note from the list or create a new one to start writing.
              </p>
              <button
                type="button"
                onClick={() => void handleCreateNote()}
                className="mt-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                New Note
              </button>
            </div>
          )}
        </section>
      </div>

      {selectedNote && (
        <div className="flex min-h-[50vh] flex-col rounded-2xl border border-slate-200 bg-white shadow-sm md:hidden">
          <NoteEditor key={selectedNote.id} note={selectedNote} onSave={handleSave} />
        </div>
      )}

      {noteToDelete && (
        <DeleteNoteConfirmModal
          note={noteToDelete}
          deleting={deleting}
          onCancel={() => {
            if (!deleting) setNoteToDelete(null);
          }}
          onConfirm={() => void handleConfirmDeleteNote()}
        />
      )}
    </div>
  );
};
