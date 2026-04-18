/**
 * Shared types for the Work (tasks) feature. Previously `ColDef` was declared
 * twice (TaskCard.tsx, TaskDetail.tsx) — same shape, but any drift between them
 * would go unnoticed since consumers imported whichever was closer.
 */
export interface ColDef {
  id: string;
  title: string;
  color: string;
}
