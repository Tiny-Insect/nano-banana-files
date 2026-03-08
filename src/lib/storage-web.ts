/**
 * Web Storage Implementation
 * Uses Supabase Storage for originals, IndexedDB for thumbnail cache.
 * This is the active implementation for the web/browser version.
 */

import { supabase } from "@/integrations/supabase/client";
import { createThumbnail } from "@/lib/generation-store";
import type { StorageAdapter, StoredImage, StorageConfig } from "./storage-adapter";
import { getStorageConfig } from "./storage-adapter";

const THUMB_DB_NAME = "nanobanana_thumbcache";
const THUMB_STORE = "thumbnails";

/** Open IndexedDB for thumbnail caching */
function openThumbDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(THUMB_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(THUMB_STORE)) {
        db.createObjectStore(THUMB_STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function cacheThumb(id: string, blob: Blob): Promise<void> {
  try {
    const db = await openThumbDB();
    const tx = db.transaction(THUMB_STORE, "readwrite");
    tx.objectStore(THUMB_STORE).put({ id, blob, cachedAt: Date.now() });
    db.close();
  } catch {
    // Cache failure is non-critical
  }
}

async function getThumbCacheSize(): Promise<number> {
  try {
    const db = await openThumbDB();
    return new Promise((resolve) => {
      const tx = db.transaction(THUMB_STORE, "readonly");
      const store = tx.objectStore(THUMB_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const total = (req.result || []).reduce((sum: number, item: any) => {
          return sum + (item.blob?.size || 0);
        }, 0);
        db.close();
        resolve(total);
      };
      req.onerror = () => { db.close(); resolve(0); };
    });
  } catch {
    return 0;
  }
}

async function clearThumbCache(): Promise<void> {
  try {
    const db = await openThumbDB();
    const tx = db.transaction(THUMB_STORE, "readwrite");
    tx.objectStore(THUMB_STORE).clear();
    db.close();
  } catch {
    // Non-critical
  }
}

export class WebStorage implements StorageAdapter {
  getMode(): "web" | "desktop" {
    return "web";
  }

  async saveGeneratedImage(blob: Blob, mimeType: string): Promise<StoredImage> {
    const ext = mimeType.includes("jpeg") ? "jpg" : mimeType.split("/")[1] || "png";
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    // Upload original to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("generated-images")
      .upload(`${id}.${ext}`, blob, { contentType: mimeType });

    if (uploadError || !uploadData) {
      throw new Error(`上传失败: ${uploadError?.message || "未知错误"}`);
    }

    const { data: urlData } = supabase.storage
      .from("generated-images")
      .getPublicUrl(uploadData.path);

    const originalUrl = urlData.publicUrl;

    // Use original for both display and thumbnail (no separate thumbnail)
    return { id, originalUrl, thumbnailUrl: originalUrl, mimeType, size: blob.size };
  }

  async saveReferenceImage(file: File): Promise<string> {
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${file.name.split(".").pop() || "png"}`;
    const { data, error } = await supabase.storage
      .from("reference-images")
      .upload(fileName, file, { contentType: file.type });

    if (error) throw new Error(`上传失败: ${error.message}`);

    const { data: urlData } = supabase.storage
      .from("reference-images")
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  }

  async downloadImage(imageUrl: string, filename: string): Promise<void> {
    const config = getStorageConfig();
    const fmt = config.downloadFormat || "png";
    const fullFilename = `${filename}.${fmt}`;

    try {
      const resp = await fetch(imageUrl);
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fullFilename;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(imageUrl, "_blank");
    }
  }

  async deleteImage(imageId: string): Promise<void> {
    try {
      await supabase.storage.from("generated-images").remove([
        `${imageId}.png`, `${imageId}.jpg`, `${imageId}.webp`,
        `thumb_${imageId}.jpg`,
      ]);
    } catch {
      // Non-critical
    }
  }

  async deleteImageByUrl(imageUrl: string): Promise<void> {
    // Extract filename from Supabase public URL
    try {
      const url = new URL(imageUrl);
      const parts = url.pathname.split("/");
      const filename = parts[parts.length - 1];
      if (filename) {
        await supabase.storage.from("generated-images").remove([filename]);
      }
    } catch {
      // Non-critical
    }
  }

  async getCacheSize(): Promise<number> {
    return getThumbCacheSize();
  }

  async clearCache(): Promise<void> {
    return clearThumbCache();
  }
}
