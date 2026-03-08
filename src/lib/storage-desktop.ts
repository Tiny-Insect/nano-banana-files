/**
 * Desktop Storage Implementation (Electron/Tauri)
 * 
 * STUB — to be implemented when packaging as desktop app.
 * Uses local filesystem for ALL storage:
 * - Originals saved to user-configured download path
 * - Thumbnails cached in app data directory
 * - No cloud dependency for image storage
 * 
 * Expected Electron/Tauri APIs:
 * - fs.writeFile / fs.readFile for local file I/O
 * - app.getPath('userData') for cache directory
 * - dialog.showSaveDialog for download path selection
 * - path.join for cross-platform path handling
 * 
 * Architecture when activated:
 * ┌─────────────────────────────────────────────┐
 * │  User's Download Folder (configurable)       │
 * │  └── LumenDust-xxx.png (downloaded originals)│
 * ├─────────────────────────────────────────────┤
 * │  App Data / Cache (auto-managed)             │
 * │  ├── originals/  (full-res, auto-cleanup)    │
 * │  ├── thumbs/     (280px thumbnails)          │
 * │  └── cache.json  (metadata index)            │
 * └─────────────────────────────────────────────┘
 * 
 * Cache cleanup strategy:
 * - Check total cache size on app start
 * - If exceeds maxCacheMB: delete oldest originals first
 * - Thumbnails are kept longer (small footprint)
 * - Downloaded files in user folder are NEVER auto-deleted
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
    // 1. Save original to cache dir: {appData}/cache/originals/{id}.{ext}
    // 2. Create thumbnail via canvas, save to: {appData}/cache/thumbs/thumb_{id}.jpg
    // 3. Return file:// URLs or app-protocol URLs
    // 4. Check cache size, cleanup if exceeds config.maxCacheMB
    
    throw new Error("Desktop storage not yet implemented. Please use web mode.");
  }

  async saveReferenceImage(file: File): Promise<string> {
    // TODO: Save to {appData}/cache/references/{filename}
    throw new Error("Desktop storage not yet implemented.");
  }

  async downloadImage(imageUrl: string, filename: string): Promise<void> {
    const config = getStorageConfig();
    const downloadPath = config.downloadPath;
    const fmt = config.downloadFormat || "png";
    const fullFilename = `${filename}.${fmt}`;

    if (!downloadPath) {
      // TODO: Show native save dialog via Electron/Tauri
      // const result = await dialog.showSaveDialog({ defaultPath: fullFilename });
      throw new Error("请在设置中配置下载保存路径");
    }

    // TODO: Implement with filesystem API
    // const fullPath = path.join(downloadPath, fullFilename);
    // const buffer = await fetch(imageUrl).then(r => r.arrayBuffer());
    // await fs.writeFile(fullPath, Buffer.from(buffer));
    
    throw new Error("Desktop storage not yet implemented.");
  }

  async deleteImage(imageId: string): Promise<void> {
    // TODO: Delete from cache dirs
    // await fs.unlink(`{appData}/cache/originals/${imageId}.*`);
    // await fs.unlink(`{appData}/cache/thumbs/thumb_${imageId}.jpg`);
  }

  async getCacheSize(): Promise<number> {
    // TODO: Walk cache directory, sum file sizes
    // const files = await fs.readdir(cacheDir);
    // return files.reduce((sum, f) => sum + f.size, 0);
    return 0;
  }

  async clearCache(): Promise<void> {
    // TODO: Delete all files in cache/thumbs and cache/originals
    // Keep downloaded files in user folder untouched
  }
}
