/**
 * Desktop Storage Implementation (Electron/Tauri)
 * 
 * STUB — to be implemented when packaging as desktop app.
 * Uses local filesystem for ALL storage:
 * - Originals saved to app cache directory
 * - Thumbnails cached in app data directory
 * - Downloads go to user-configured folder
 * - No cloud dependency for image storage
 * 
 * ┌─────────────────────────────────────────────────────┐
 * │  User's Download Folder (configurable, NEVER deleted)│
 * │  └── LumenDust-xxx.png (user-saved originals)       │
 * ├─────────────────────────────────────────────────────┤
 * │  App Data / Cache (auto-managed, size-limited)       │
 * │  ├── originals/  (full-res generated images)         │
 * │  ├── thumbs/     (280px JPEG thumbnails)             │
 * │  └── cache.json  (metadata: id→filePath mapping)     │
 * └─────────────────────────────────────────────────────┘
 * 
 * CACHE CLEANUP STRATEGY (user chose: "只清文件，保留元数据"):
 * - Task metadata (prompt, params, URLs/paths) stored in localStorage → NEVER auto-deleted
 * - clearCache() only deletes local file copies (originals + thumbs)
 * - Cloud URLs in metadata remain valid → can re-download on demand
 * - After cleanup, UI shows placeholder → click to reload from cloud
 * - User's manually-downloaded files in download folder → NEVER touched
 * 
 * SIZE MANAGEMENT:
 * - On app start: check total cache size vs maxCacheMB setting
 * - If over limit: delete oldest originals first (by createdAt)
 * - Thumbnails are kept longer (tiny footprint, ~30KB each)
 * - Only delete thumbs in "deep clean" mode
 * 
 * Expected APIs:
 * - Electron: fs.writeFile, fs.readFile, fs.unlink, fs.readdir, app.getPath('userData')
 * - Tauri: @tauri-apps/api/fs, @tauri-apps/api/path
 */

import type { StorageAdapter, StoredImage } from "./storage-adapter";
import { getStorageConfig } from "./storage-adapter";

export class DesktopStorage implements StorageAdapter {
  getMode(): "web" | "desktop" {
    return "desktop";
  }

  async saveGeneratedImage(blob: Blob, mimeType: string): Promise<StoredImage> {
    const config = getStorageConfig();
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    
    // TODO: Implement with Electron/Tauri filesystem API
    // 1. Save original: {appData}/cache/originals/{id}.{ext}
    // 2. Create thumbnail via canvas → save: {appData}/cache/thumbs/thumb_{id}.jpg
    // 3. Update cache.json index with: { id, originalPath, thumbPath, size, createdAt }
    // 4. Check total cache size, auto-cleanup if > config.maxCacheMB
    // 5. Return file:// URLs or custom app-protocol URLs
    
    throw new Error("Desktop storage not yet implemented. Please use web mode.");
  }

  async saveReferenceImage(file: File): Promise<string> {
    // TODO: Save to {appData}/cache/references/{filename}
    // Return file:// URL
    throw new Error("Desktop storage not yet implemented.");
  }

  async downloadImage(imageUrl: string, filename: string): Promise<void> {
    const config = getStorageConfig();
    const downloadPath = config.downloadPath;
    const fmt = config.downloadFormat || "png";
    const fullFilename = `${filename}.${fmt}`;

    if (!downloadPath) {
      // TODO: Show native save dialog
      // Electron: dialog.showSaveDialog({ defaultPath: fullFilename })
      // Tauri: @tauri-apps/api/dialog.save({ defaultPath: fullFilename })
      throw new Error("请在设置中配置下载保存路径");
    }

    // TODO: 
    // const fullPath = path.join(downloadPath, fullFilename);
    // const buffer = await fetch(imageUrl).then(r => r.arrayBuffer());
    // await fs.writeFile(fullPath, Buffer.from(buffer));
    // Note: imageUrl could be file:// (local cache) or https:// (cloud fallback)
    
    throw new Error("Desktop storage not yet implemented.");
  }

  async deleteImage(imageId: string): Promise<void> {
    // Delete local cached files only, metadata stays in localStorage
    // TODO:
    // await fs.unlink(`{appData}/cache/originals/${imageId}.*`);
    // await fs.unlink(`{appData}/cache/thumbs/thumb_${imageId}.jpg`);
    // Update cache.json to mark as "evicted" (URL still valid for cloud reload)
  }

  async getCacheSize(): Promise<number> {
    // TODO: Walk originals/ + thumbs/ directories, sum file sizes
    return 0;
  }

  async clearCache(): Promise<void> {
    // STRATEGY: Only delete local file copies, preserve metadata
    // 1. Delete all files in cache/originals/
    // 2. Delete all files in cache/thumbs/
    // 3. Do NOT delete cache.json (keeps id→cloudUrl mapping for reload)
    // 4. Do NOT touch user's download folder
    // After this, task list still shows, images show placeholder,
    // clicking loads from cloud URL in metadata
  }
}
