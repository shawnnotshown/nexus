export const EMPTY_RICH_TEXT_DOC = '{"type":"doc","content":[{"type":"paragraph"}]}';

export function parseRichTextDoc(content: string): Record<string, unknown> {
  if (!content.trim()) {
    return JSON.parse(EMPTY_RICH_TEXT_DOC) as Record<string, unknown>;
  }
  try {
    const parsed = JSON.parse(content) as { type?: string };
    if (parsed?.type === "doc") return parsed as Record<string, unknown>;
  } catch {
    /* fall through to plain text */
  }
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: content ? [{ type: "text", text: content }] : [],
      },
    ],
  };
}

export function extractTextPreview(content: string, maxLength = 80): string {
  if (!content.trim()) return "";
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
    if (!text) return "";
    return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
  } catch {
    const plain = content.trim();
    if (!plain) return "";
    return plain.length > maxLength ? `${plain.slice(0, maxLength)}…` : plain;
  }
}

export function isRichTextEmpty(content: string): boolean {
  return extractTextPreview(content, 10_000).trim().length === 0;
}

export function richTextToPlainText(content: string): string {
  return extractTextPreview(content, 1_000_000);
}
