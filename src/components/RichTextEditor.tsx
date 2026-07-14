"use client";

import React, { useEffect, useRef } from "react";
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
  Quote,
  Redo,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EMPTY_RICH_TEXT_DOC, isRichTextEmpty, parseRichTextDoc } from "@/lib/richText";

const editorExtensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
  }),
  Underline,
  Highlight,
  TextAlign.configure({
    types: ["heading", "paragraph"],
  }),
];

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
        "inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100 hover:text-gray-900 disabled:opacity-40",
        active && "bg-indigo-50 text-indigo-600"
      )}
    >
      {children}
    </button>
  );
}

function RichTextToolbar({ editor, compact }: { editor: NonNullable<ReturnType<typeof useEditor>>; compact?: boolean }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-slate-50/80",
        compact ? "px-1.5 py-1" : "px-2 py-1.5"
      )}
    >
      <ToolbarButton title="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title="Underline" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <UnderlineIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title="Strikethrough" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <Strikethrough className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title="Highlight" active={editor.isActive("highlight")} onClick={() => editor.chain().focus().toggleHighlight().run()}>
        <Highlighter className="h-4 w-4" />
      </ToolbarButton>

      {!compact && (
        <>
          <span className="mx-1 h-5 w-px bg-slate-200" />
          <ToolbarButton title="Heading 1" active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
            <Heading1 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton title="Heading 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
            <Heading2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton title="Heading 3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
            <Heading3 className="h-4 w-4" />
          </ToolbarButton>
        </>
      )}

      <span className="mx-1 h-5 w-px bg-slate-200" />

      <ToolbarButton title="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title="Ordered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title="Blockquote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <Quote className="h-4 w-4" />
      </ToolbarButton>
      {!compact && (
        <ToolbarButton title="Code block" active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
          <Code className="h-4 w-4" />
        </ToolbarButton>
      )}

      {!compact && (
        <>
          <span className="mx-1 h-5 w-px bg-slate-200" />
          <ToolbarButton title="Align left" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()}>
            <AlignLeft className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton title="Align center" active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()}>
            <AlignCenter className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton title="Align right" active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()}>
            <AlignRight className="h-4 w-4" />
          </ToolbarButton>
        </>
      )}

      <span className="mx-1 h-5 w-px bg-slate-200" />

      <ToolbarButton title="Undo" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
        <Undo className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title="Redo" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
        <Redo className="h-4 w-4" />
      </ToolbarButton>
    </div>
  );
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Write something…",
  compact = false,
  className,
  editorClassName,
}: {
  value: string;
  onChange: (json: string) => void;
  placeholder?: string;
  compact?: boolean;
  className?: string;
  editorClassName?: string;
}) {
  const contentKeyRef = useRef(value || EMPTY_RICH_TEXT_DOC);
  const [, setToolbarTick] = React.useState(0);

  const editor = useEditor({
    extensions: [
      ...editorExtensions,
      Placeholder.configure({ placeholder }),
    ],
    content: parseRichTextDoc(value || EMPTY_RICH_TEXT_DOC),
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: cn(
          "notes-editor-content outline-none",
          compact ? "min-h-[88px] px-3 py-2 text-sm" : "min-h-[160px] px-4 py-3",
          editorClassName
        ),
      },
    },
    onUpdate: ({ editor: ed }) => {
      const next = JSON.stringify(ed.getJSON());
      contentKeyRef.current = next;
      onChange(next);
    },
    onSelectionUpdate: () => {
      setToolbarTick((n) => n + 1);
    },
  });

  useEffect(() => {
    if (!editor) return;
    const normalized = value || EMPTY_RICH_TEXT_DOC;
    if (normalized === contentKeyRef.current) return;
    // TipTap empty docs can serialize differently; treat empty↔empty as synced.
    if (isRichTextEmpty(normalized) && isRichTextEmpty(contentKeyRef.current)) {
      contentKeyRef.current = normalized;
      return;
    }
    contentKeyRef.current = normalized;
    editor.commands.setContent(parseRichTextDoc(normalized), { emitUpdate: false });
  }, [editor, value]);

  if (!editor) {
    return (
      <div className={cn("rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500", className)}>
        Loading editor…
      </div>
    );
  }

  return (
    <div className={cn("overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm", className)}>
      <RichTextToolbar editor={editor} compact={compact} />
      <EditorContent editor={editor} />
    </div>
  );
}

export function RichTextViewer({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const editor = useEditor({
    extensions: editorExtensions,
    content: parseRichTextDoc(content),
    editable: false,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: cn("notes-editor-content outline-none", className),
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.commands.setContent(parseRichTextDoc(content), { emitUpdate: false });
  }, [editor, content]);

  if (!editor) return null;

  return <EditorContent editor={editor} />;
}
