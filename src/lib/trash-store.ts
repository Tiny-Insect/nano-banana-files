/**
 * Trash / Recently Deleted store
 * Soft-deleted tasks are stored here in localStorage.
 * Only tasks with generated images go here (failed tasks are permanently deleted).
 */

import type { GenerationTask } from "./generation-store";

const TRASH_KEY = "nanobanana_trash";
const MAX_TRASH = 200;

export interface TrashedTask extends GenerationTask {
  deletedAt: number;
}

export function loadTrash(): TrashedTask[] {
  try {
    const raw = localStorage.getItem(TRASH_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as TrashedTask[];
  } catch {
    return [];
  }
}

export function saveTrash(items: TrashedTask[]) {
  try {
    const toSave = items.slice(-MAX_TRASH).map((t) => ({
      ...t,
      referenceImageBase64: (t.referenceImageBase64 || []).filter(img => img.startsWith("http")),
      referenceImagePreviews: (t.referenceImagePreviews || []).filter(img => img.startsWith("http")),
      generatedImages: (t.generatedImages || []).filter(img => img.startsWith("http")),
      thumbnails: (t.thumbnails || []).filter(img => img.startsWith("http")),
    }));
    localStorage.setItem(TRASH_KEY, JSON.stringify(toSave));
  } catch {
    try {
      localStorage.setItem(TRASH_KEY, JSON.stringify(items.slice(-20)));
    } catch {
      // give up
    }
  }
}

/** Move a task to trash (soft delete). Only if it has generated images. */
export function moveToTrash(task: GenerationTask): boolean {
  if (task.status !== "complete" || !task.generatedImages || task.generatedImages.length === 0) {
    return false; // failed tasks don't go to trash
  }
  const trash = loadTrash();
  const trashedTask: TrashedTask = { ...task, deletedAt: Date.now() };
  trash.push(trashedTask);
  saveTrash(trash);
  return true;
}

/** Restore a task from trash, returns the task to re-insert */
export function restoreFromTrash(taskId: string): GenerationTask | null {
  const trash = loadTrash();
  const idx = trash.findIndex((t) => t.id === taskId);
  if (idx === -1) return null;
  const [item] = trash.splice(idx, 1);
  saveTrash(trash);
  // Remove deletedAt, return as GenerationTask
  const { deletedAt, ...task } = item;
  return task as GenerationTask;
}

/** Permanently delete from trash */
export function permanentDelete(taskId: string) {
  const trash = loadTrash();
  saveTrash(trash.filter((t) => t.id !== taskId));
}

/** Clear all trash */
export function clearAllTrash() {
  localStorage.removeItem(TRASH_KEY);
}
