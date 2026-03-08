/**
 * Trash / Recently Deleted store
 * Soft-deleted tasks are stored here in localStorage.
 * Only tasks with generated images go here (failed tasks are permanently deleted).
 */

import type { GenerationTask } from "./generation-store";
import { getStorage } from "./storage-factory";

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
      referenceImageBase64: (t.referenceImageBase64 || []).filter(img => img.startsWith("http") || img.startsWith("local-file://")),
      referenceImagePreviews: (t.referenceImagePreviews || []).filter(img => img.startsWith("http") || img.startsWith("local-file://")),
      generatedImages: (t.generatedImages || []).filter(img => img.startsWith("http") || img.startsWith("local-file://")),
      thumbnails: (t.thumbnails || []).filter(img => img.startsWith("http") || img.startsWith("local-file://")),
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

/** Delete cached image files for a task */
async function deleteCachedFiles(task: TrashedTask | GenerationTask): Promise<void> {
  try {
    const storage = getStorage();
    const urls = [...(task.generatedImages || []), ...(task.thumbnails || [])];
    const unique = [...new Set(urls)];
    await Promise.all(unique.map((url) => storage.deleteImageByUrl(url)));
  } catch {
    // Best-effort
  }
}

/** Permanently delete from trash (also deletes cached files) */
export async function permanentDelete(taskId: string): Promise<void> {
  const trash = loadTrash();
  const task = trash.find((t) => t.id === taskId);
  if (task) {
    await deleteCachedFiles(task);
  }
  saveTrash(trash.filter((t) => t.id !== taskId));
}

/** Clear all trash (also deletes all cached files) */
export async function clearAllTrash(): Promise<void> {
  const trash = loadTrash();
  await Promise.all(trash.map((t) => deleteCachedFiles(t)));
  localStorage.removeItem(TRASH_KEY);
}
