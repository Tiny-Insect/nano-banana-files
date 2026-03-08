/**
 * Storage Abstraction Layer
 * 
 * Architecture:
 * ┌────────────────────────────────────────────┐
 * │           StorageAdapter Interface          │
 * ├────────────────┬───────────────────────────┤
 * │  WebStorage    │    DesktopStorage          │
 * │  (Supabase +   │    (Local filesystem       │
 * │   IndexedDB)   │     via Electron/Tauri)    │
 * └────────────────┴───────────────────────────┘
 * 
 * Three-tier image model:
 * 1. Thumbnail (~280px JPEG) → fast list display
 * 2. Preview (original URL/path) → lightbox viewing
 * 3. Download (original) → save to user-specified folder
 */

export interface StoredImage {
  /** Unique ID for this image */
  id: string;
  /** URL or path to the original full-resolution image */
  originalUrl: string;
  /** URL or path to the thumbnail */
  thumbnailUrl: string;
  /** MIME type */
  mimeType: string;
  /** File size in bytes (original) */
  size?: number;
}

export interface StorageAdapter {
  /** 
   * Save a generated image (original + auto-create thumbnail)
   * Returns StoredImage with both URLs
   */
  saveGeneratedImage(blob: Blob, mimeType: string): Promise<StoredImage>;

  /**
   * Save a reference image uploaded by user
   */
  saveReferenceImage(file: File): Promise<string>;

  /**
   * Download an image to the user's specified download folder.
   * On web: triggers browser download. On desktop: saves to configured path.
   */
  downloadImage(imageUrl: string, filename: string): Promise<void>;

  /**
   * Delete an image and its thumbnail from storage
   */
  deleteImage(imageId: string): Promise<void>;

  /**
   * Get total cache size in bytes
   */
  getCacheSize(): Promise<number>;

  /**
   * Clear cached thumbnails/temporary files, keeping originals
   */
  clearCache(): Promise<void>;

  /**
   * Get the current storage mode label
   */
  getMode(): "web" | "desktop";
}

export interface StorageConfig {
  /** User-configured download path (desktop only) */
  downloadPath: string;
  /** User-configured cache path (desktop only) */
  cachePath: string;
  /** Max cache size in MB */
  maxCacheMB: number | null;
  /** Download file prefix */
  downloadPrefix: string;
  /** Download file format */
  downloadFormat: string;
}

export function getStorageConfig(): StorageConfig {
  try {
    const raw = localStorage.getItem("nanobanana_settings");
    if (!raw) return { downloadPath: "", cachePath: "", maxCacheMB: null, downloadPrefix: "LumenDust", downloadFormat: "png" };
    const s = JSON.parse(raw);
    return {
      downloadPath: s.downloadPath || "",
      cachePath: s.cachePath || "",
      maxCacheMB: s.maxCacheMB ?? null,
      downloadPrefix: s.downloadPrefix || "LumenDust",
      downloadFormat: s.downloadFormat || "png",
    };
  } catch {
    return { downloadPath: "", cachePath: "", maxCacheMB: null, downloadPrefix: "LumenDust", downloadFormat: "png" };
  }
}
