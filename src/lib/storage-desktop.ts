/**
 * Desktop Storage Implementation (Electron)
 * 
 * Uses local filesystem via Electron IPC for ALL storage:
 * - Originals saved to cache directory (user-configurable)
 * - Thumbnails cached alongside originals
 * - Downloads go to user-configured folder
 * - No cloud dependency for image storage
 */

import type { StorageAdapter, StoredImage } from "./storage-adapter";
import { getStorageConfig } from "./storage-adapter";

const electronAPI = (window as any).electronAPI;

/** Get the effective cache directory (user-configured or default) */
async function getCacheDir(): Promise<string> {
  const config = getStorageConfig();
  if (config.cachePath) return config.cachePath;
  // Fall back to Electron's default userData/cache
  return electronAPI.getCachePath();
}

/** Convert Blob to base64 string */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Strip data URL prefix: "data:image/png;base64,..."
      const base64 = result.split(",")[1] || result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Create a thumbnail from a blob using canvas */
async function createThumbnail(blob: Blob, maxSize: number = 280): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1);
      canvas.width = Math.round(img.width * ratio);
      canvas.height = Math.round(img.height * ratio);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Thumbnail creation failed"))),
        "image/jpeg",
        0.8
      );
    };
    img.onerror = reject;
    img.src = url;
  });
}

export class DesktopStorage implements StorageAdapter {
  getMode(): "web" | "desktop" {
    return "desktop";
  }

  async saveGeneratedImage(blob: Blob, mimeType: string): Promise<StoredImage> {
    const ext = mimeType.includes("jpeg") ? "jpg" : mimeType.split("/")[1] || "png";
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const cacheDir = await getCacheDir();

    // Ensure directories exist
    const originalsDir = `${cacheDir}/originals`;
    const thumbsDir = `${cacheDir}/thumbs`;
    await Promise.all([
      electronAPI.fsMkdir(originalsDir),
      electronAPI.fsMkdir(thumbsDir),
    ]);

    // Save original
    const originalPath = `${originalsDir}/${id}.${ext}`;
    const base64 = await blobToBase64(blob);
    await electronAPI.fsWriteFile(originalPath, base64);

    // Create and save thumbnail
    let thumbPath = originalPath; // fallback
    try {
      const thumbBlob = await createThumbnail(blob, 280);
      thumbPath = `${thumbsDir}/thumb_${id}.jpg`;
      const thumbBase64 = await blobToBase64(thumbBlob);
      await electronAPI.fsWriteFile(thumbPath, thumbBase64);
    } catch {
      // Thumbnail creation failed, use original
    }

    // Check cache size and auto-cleanup if needed
    const config = getStorageConfig();
    if (config.maxCacheMB) {
      const totalSize = await this.getCacheSize();
      if (totalSize > config.maxCacheMB * 1024 * 1024) {
        // TODO: Implement LRU cleanup of oldest originals
        console.warn("[DesktopStorage] Cache size exceeds limit, cleanup needed");
      }
    }

    // Return local-file:// URLs for secure local display via custom protocol
    // Use standard URL format: local-file://serve/<absolute-path>
    const normalizedOriginal = originalPath.replace(/\\/g, "/");
    const normalizedThumb = thumbPath.replace(/\\/g, "/");
    const originalUrl = `local-file://serve/${normalizedOriginal}`;
    const thumbnailUrl = `local-file://serve/${normalizedThumb}`;

    console.log("[DesktopStorage] Saved image:", { id, originalUrl, thumbnailUrl });

    return { id, originalUrl, thumbnailUrl, mimeType, size: blob.size };
  }

  async saveReferenceImage(file: File): Promise<string> {
    const cacheDir = await getCacheDir();
    const refsDir = `${cacheDir}/references`;
    await electronAPI.fsMkdir(refsDir);

    const ext = file.name.split(".").pop() || "png";
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const filePath = `${refsDir}/${fileName}`;

    const blob = new Blob([await file.arrayBuffer()], { type: file.type });
    const base64 = await blobToBase64(blob);
    await electronAPI.fsWriteFile(filePath, base64);

    return `local-file://${filePath.replace(/\\/g, "/")}`;
  }

  async downloadImage(imageUrl: string, filename: string): Promise<void> {
    const config = getStorageConfig();
    const downloadPath = config.downloadPath;
    const fmt = config.downloadFormat || "png";
    const fullFilename = `${filename}.${fmt}`;

    if (!downloadPath) {
      // No download path configured, use folder picker
      const dir = await electronAPI.selectFolder("选择下载保存路径");
      if (!dir) return;
      await this._saveToDir(imageUrl, dir, fullFilename);
      return;
    }

    await this._saveToDir(imageUrl, downloadPath, fullFilename);
  }

  private async _saveToDir(imageUrl: string, dir: string, filename: string): Promise<void> {
    const filePath = `${dir}/${filename}`;

    if (imageUrl.startsWith("local-file://") || imageUrl.startsWith("file://")) {
      // Local file - read and copy
      const localPath = imageUrl.replace("local-file://", "").replace("file://", "");
      const base64 = await electronAPI.fsReadFile(localPath);
      if (base64) {
        await electronAPI.fsWriteFile(filePath, base64);
      }
    } else {
      // Remote URL - fetch and save
      const resp = await fetch(imageUrl);
      const blob = await resp.blob();
      const base64 = await blobToBase64(blob);
      await electronAPI.fsWriteFile(filePath, base64);
    }
  }

  async deleteImage(imageId: string): Promise<void> {
    const cacheDir = await getCacheDir();
    // Try common extensions
    for (const ext of ["png", "jpg", "webp"]) {
      await electronAPI.fsDeleteFile(`${cacheDir}/originals/${imageId}.${ext}`);
    }
    await electronAPI.fsDeleteFile(`${cacheDir}/thumbs/thumb_${imageId}.jpg`);
  }

  async getCacheSize(): Promise<number> {
    const cacheDir = await getCacheDir();
    const [originalsSize, thumbsSize] = await Promise.all([
      electronAPI.fsGetSize(`${cacheDir}/originals`),
      electronAPI.fsGetSize(`${cacheDir}/thumbs`),
    ]);
    return (originalsSize || 0) + (thumbsSize || 0);
  }

  async clearCache(): Promise<void> {
    const cacheDir = await getCacheDir();
    // Delete all files in originals and thumbs
    const [originals, thumbs] = await Promise.all([
      electronAPI.fsReadDir(`${cacheDir}/originals`),
      electronAPI.fsReadDir(`${cacheDir}/thumbs`),
    ]);
    const deletes = [
      ...(originals || []).map((f: string) => electronAPI.fsDeleteFile(`${cacheDir}/originals/${f}`)),
      ...(thumbs || []).map((f: string) => electronAPI.fsDeleteFile(`${cacheDir}/thumbs/${f}`)),
    ];
    await Promise.all(deletes);
  }
}
