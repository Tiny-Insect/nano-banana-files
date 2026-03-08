/**
 * Storage Factory
 * 
 * Detects runtime environment and returns the appropriate storage adapter.
 * - Web browser → WebStorage (Supabase + IndexedDB)
 * - Electron → DesktopStorage (filesystem)
 * - Tauri → DesktopStorage (filesystem)
 */

import type { StorageAdapter } from "./storage-adapter";
import { WebStorage } from "./storage-web";
// import { DesktopStorage } from "./storage-desktop";

/** Detect if running inside Electron */
function isElectron(): boolean {
  return typeof window !== "undefined" && 
    !!(window as any).electron || 
    (typeof navigator !== "undefined" && navigator.userAgent.includes("Electron"));
}

/** Detect if running inside Tauri */
function isTauri(): boolean {
  return typeof window !== "undefined" && !!(window as any).__TAURI__;
}

let _instance: StorageAdapter | null = null;

/**
 * Get the singleton storage adapter for the current environment.
 * Web mode uses Supabase Storage + IndexedDB cache.
 * Desktop mode (future) uses local filesystem.
 */
export function getStorage(): StorageAdapter {
  if (_instance) return _instance;

  if (isElectron() || isTauri()) {
    // When desktop is implemented, uncomment:
    // _instance = new DesktopStorage();
    // For now, fall back to web
    console.info("[Storage] Desktop environment detected but not yet implemented, using web storage");
    _instance = new WebStorage();
  } else {
    _instance = new WebStorage();
  }

  return _instance;
}

/** Reset storage instance (useful for testing or mode switching) */
export function resetStorage(): void {
  _instance = null;
}
