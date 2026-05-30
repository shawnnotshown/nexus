import { format } from "date-fns";
import { jsPDF } from "jspdf";
import type { ProjectTodoList } from "../types";

const MARGIN_X = 14;
const PAGE_WIDTH = 210;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const LINE_HEIGHT = 6;
const PAGE_BOTTOM = 285;

export type ExportTodosPdfOptions = {
  projectName: string;
  lists: ProjectTodoList[];
  resolveUserName: (userId: string) => string;
};

export function todosPdfFilename(projectName: string): string {
  const safe = projectName.replace(/[<>:"/\\|?*\n\r]/g, "").trim() || "Project";
  return `To-dos ${safe}.pdf`;
}

export function exportTodosToPdf({ projectName, lists, resolveUserName }: ExportTodosPdfOptions): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = 20;

  const ensureSpace = (needed: number) => {
    if (y + needed > PAGE_BOTTOM) {
      doc.addPage();
      y = 20;
    }
  };

  const writeLines = (lines: string[], fontSize: number, opts?: { bold?: boolean }) => {
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
    for (const line of lines) {
      ensureSpace(LINE_HEIGHT);
      doc.text(line, MARGIN_X, y);
      y += LINE_HEIGHT;
    }
  };

  writeLines([projectName], 18, { bold: true });
  y += 2;
  writeLines(
    [`To-Dos · Exported ${format(new Date(), "MMM d, yyyy")}`],
    10
  );
  y += 6;

  if (lists.length === 0) {
    writeLines(["No lists yet."], 11);
    doc.save(todosPdfFilename(projectName));
    return;
  }

  for (const list of lists) {
    ensureSpace(LINE_HEIGHT * 2);
    writeLines([list.name], 14, { bold: true });
    y += 2;

    if (list.tasks.length === 0) {
      writeLines(["(No tasks)"], 10);
      y += 4;
      continue;
    }

    for (const task of list.tasks) {
      const status = task.completed ? "Done" : "Open";
      const due = task.dueDate ? format(new Date(task.dueDate), "MMM d, yyyy") : null;
      const assignees =
        task.assignees.length > 0
          ? task.assignees.map((id) => resolveUserName(id)).join(", ")
          : null;

      const metaParts = [`Status: ${status}`];
      if (due) metaParts.push(`Due: ${due}`);
      if (assignees) metaParts.push(`Assigned: ${assignees}`);

      const prefix = task.completed ? "[x] " : "[ ] ";
      const titleLines = doc.splitTextToSize(`${prefix}${task.title}`, CONTENT_WIDTH - 4);
      const metaLines = doc.splitTextToSize(metaParts.join(" · "), CONTENT_WIDTH - 8);

      ensureSpace((titleLines.length + metaLines.length + 2) * LINE_HEIGHT);
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      for (const line of titleLines) {
        doc.text(line, MARGIN_X + 2, y);
        y += LINE_HEIGHT;
      }
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      for (const line of metaLines) {
        doc.text(line, MARGIN_X + 4, y);
        y += LINE_HEIGHT - 0.5;
      }
      doc.setTextColor(0, 0, 0);
      y += 3;
    }
    y += 4;
  }

  doc.save(todosPdfFilename(projectName));
}
