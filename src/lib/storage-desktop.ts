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
  return electronAPI.getCachePath();
}

async function getAppDataPaths(): Promise<{ root: string; chat: string; thumbnails: string; originals: string; downloads: string }> {
  if (electronAPI.getAppDataPaths) {
    return electronAPI.getAppDataPaths();
  }
  const root = await getCacheDir();
  return {
    root,
    chat: `${root}/chat`,
    thumbnails: `${root}/thumbnails`,
    originals: `${root}/originals`,
    downloads: `${root}/LumenDust Download`,
  };
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

function normalizeLocalFilePath(pathname: string): string {
  let localPath = decodeURIComponent(pathname);
  if (/^\/[A-Za-z]:\//.test(localPath)) {
    localPath = localPath.slice(1);
  }
  return localPath;
}

async function convertBlobFormat(blob: Blob, format: string): Promise<Blob> {
  const targetMime = format === "jpg" ? "image/jpeg" : `image/${format}`;
  if ((format === "png" && blob.type === "image/png") ||
      (format === "jpg" && blob.type === "image/jpeg") ||
      (format === "webp" && blob.type === "image/webp")) {
    return blob;
  }

  try {
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return blob;
    ctx.drawImage(bitmap, 0, 0);

    const converted = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), targetMime, 0.92);
    });
    bitmap.close();
    return converted || blob;
  } catch {
    return blob;
  }
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
    const appPaths = await getAppDataPaths();

    // Ensure directories exist
    const originalsDir = appPaths.originals;
    const thumbsDir = appPaths.thumbnails;
    await Promise.all([
      electronAPI.fsMkdir(originalsDir),
      electronAPI.fsMkdir(thumbsDir),
    ]);

    // Save original asset
    const originalPath = `${originalsDir}/${id}.${ext}`;
    const base64 = await blobToBase64(blob);
    await electronAPI.fsWriteFile(originalPath, base64);

    // Save derived thumbnail for list/grid surfaces
    let thumbnailPath = "";
    try {
      const thumbBlob = await createThumbnail(blob);
      const thumbBase64 = await blobToBase64(thumbBlob);
      thumbnailPath = `${thumbsDir}/thumb_${id}.jpg`;
      await electronAPI.fsWriteFile(thumbnailPath, thumbBase64);
    } catch (err) {
      console.warn("[DesktopStorage] Thumbnail generation failed, falling back to original:", err);
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
    const originalUrl = `local-file://serve/${normalizedOriginal}`;
    const thumbnailUrl = thumbnailPath
      ? `local-file://serve/${thumbnailPath.replace(/\\/g, "/")}`
      : originalUrl;

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

    return `local-file://serve/${filePath.replace(/\\/g, "/")}`;
  }

  async downloadImage(imageUrl: string, filename: string): Promise<void> {
    const config = getStorageConfig();
    const appPaths = await getAppDataPaths();
    const downloadPath = config.downloadPath || appPaths.downloads;
    const fmt = config.downloadFormat || "png";
    const fullFilename = `${filename}.${fmt}`;

    await electronAPI.fsMkdir(downloadPath);
    await this._saveToDir(imageUrl, downloadPath, fullFilename);
  }

  private async _saveToDir(imageUrl: string, dir: string, filename: string): Promise<void> {
    const filePath = `${dir}/${filename}`;
    const fmt = filename.split(".").pop()?.toLowerCase() || "png";
    const targetFmt = fmt === "jpeg" ? "jpg" : fmt;

    if (imageUrl.startsWith("local-file://")) {
      // Local file - extract path from URL: local-file://serve/C:/path
      const parsed = new URL(imageUrl);
      const localPath = normalizeLocalFilePath(parsed.pathname);
      const base64 = await electronAPI.fsReadFile(localPath);
      if (base64) {
        const sourceMime = imageUrl.endsWith(".jpg") || imageUrl.endsWith(".jpeg")
          ? "image/jpeg"
          : imageUrl.endsWith(".webp")
            ? "image/webp"
            : "image/png";
        const sourceBlob = await fetch(`data:${sourceMime};base64,${base64}`).then(r => r.blob());
        const converted = await convertBlobFormat(sourceBlob, targetFmt);
        const outBase64 = await blobToBase64(converted);
        await electronAPI.fsWriteFile(filePath, outBase64);
      }
    } else {
      // Remote URL - fetch and save
      const resp = await fetch(imageUrl);
      const blob = await resp.blob();
      const converted = await convertBlobFormat(blob, targetFmt);
      const base64 = await blobToBase64(converted);
      await electronAPI.fsWriteFile(filePath, base64);
    }
  }

  async deleteImage(imageId: string): Promise<void> {
    const cacheDir = await getCacheDir();
    for (const ext of ["png", "jpg", "webp"]) {
      await electronAPI.fsDeleteFile(`${cacheDir}/originals/${imageId}.${ext}`);
    }
    await electronAPI.fsDeleteFile(`${cacheDir}/thumbs/thumb_${imageId}.jpg`);
  }

  async deleteImageByUrl(imageUrl: string): Promise<void> {
    if (!imageUrl.startsWith("local-file://")) return;
    try {
      const parsed = new URL(imageUrl);
      let localPath = normalizeLocalFilePath(parsed.pathname);
      localPath = localPath.replace(/\//g, "\\");
      await electronAPI.fsDeleteFile(localPath);
    } catch {
      // Best-effort
    }
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
    // On desktop, originals are the durable local asset library.
    // clearCache() should only remove regenerable preview files.
    const thumbs = await electronAPI.fsReadDir(`${cacheDir}/thumbs`);
    const deletes = [
      ...(thumbs || []).map((f: string) => electronAPI.fsDeleteFile(`${cacheDir}/thumbs/${f}`)),
    ];
    await Promise.all(deletes);
  }
}
