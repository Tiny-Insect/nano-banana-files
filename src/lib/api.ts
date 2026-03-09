/**
 * Shared API utilities for generation calls.
 * Eliminates duplication between Home.tsx and Assets.tsx.
 */

import { supabase } from "@/integrations/supabase/client";
import { loadSettings } from "@/components/Layout";
import { getStorage } from "@/lib/storage-factory";
import type { GenerationTask } from "@/lib/generation-store";

/**
 * Separate image URLs into remote URLs (usable by API) and base64 data.
 * local-file:// URLs are read via Electron IPC and converted to base64.
 */
export async function prepareImageUrls(urls: string[]): Promise<{ image_urls: string[]; images: string[] }> {
  const image_urls: string[] = [];
  const images: string[] = [];
  const electronAPI = (window as any).electronAPI;

  for (const url of urls) {
    if (url.startsWith("local-file://")) {
      // Read local file and convert to base64
      try {
        const parsed = new URL(url);
        let localPath = decodeURIComponent(parsed.pathname);
        if (localPath.startsWith("/")) localPath = localPath.slice(1);
        if (electronAPI?.fsReadFile) {
          const base64 = await electronAPI.fsReadFile(localPath);
          images.push(base64);
        }
      } catch (e) {
        console.warn("Failed to read local-file for API:", url, e);
      }
    } else if (url.startsWith("http")) {
      image_urls.push(url);
    } else if (url.startsWith("data:")) {
      const raw = url.split(",")[1];
      if (raw) images.push(raw);
    } else {
      // Treat as raw base64
      images.push(url);
    }
  }
  return { image_urls, images };
}

export function getCustomApiHeaders(): Record<string, string> {
  const s = loadSettings();
  const headers: Record<string, string> = {};
  if (s.customApiUrl.trim()) headers["X-Custom-Api-Url"] = s.customApiUrl.trim();
  if (s.customApiKey.trim()) headers["X-Custom-Api-Key"] = s.customApiKey.trim();
  return headers;
}

export async function callGenerateApi(body: Record<string, any>): Promise<any> {
  const customHeaders = getCustomApiHeaders();
  const { data, error } = await supabase.functions.invoke("generate", {
    body,
    headers: customHeaders,
  });
  if (error) throw error;

  if (data && data.error) return data;
  if (data && data.images) return data;

  const storage = getStorage();
  const images: string[] = [];
  const thumbnails: string[] = [];

  if (data?.candidates) {
    for (const candidate of data.candidates) {
      if (candidate?.finishReason === "SAFETY") {
        return { error: "请求被安全过滤器拦截，请尝试修改提示词" };
      }
      if (candidate?.content?.parts) {
        for (const part of candidate.content.parts) {
          const imgData = part.inlineData || part.inline_data;
          if (imgData?.data) {
            const mimeType = imgData.mimeType || imgData.mime_type || "image/png";
            const dataUrl = `data:${mimeType};base64,${imgData.data}`;
            try {
              const blob = await fetch(dataUrl).then(r => r.blob());
              const stored = await storage.saveGeneratedImage(blob, mimeType);
              images.push(stored.originalUrl);
              thumbnails.push(stored.thumbnailUrl);
            } catch {
              images.push(dataUrl);
              thumbnails.push(dataUrl);
            }
          }
        }
      }
    }
  }

  if (images.length > 0) return { images, thumbnails };
  return { error: "未返回图片", raw: data };
}

/** Shared download helper — always downloads the original image from task.generatedImages */
export async function downloadOriginalImage(url: string, index: number): Promise<string | undefined> {
  const s = loadSettings();
  const prefix = s.downloadPrefix || "LumenDust";
  try {
    const storage = getStorage();
    await storage.downloadImage(url, `${prefix}-${Date.now()}-${index}`);
    // Return the download path for toast display
    const downloadPath = s.downloadPath || (storage.getMode() === "web" ? "浏览器下载目录" : undefined);
    return downloadPath || undefined;
  } catch {
    window.open(url, "_blank");
    return undefined;
  }
}

/**
 * Core generation execution logic.
 * Used by both handleGenerate (Home) and handleReGenerate (Home/Assets).
 */
export async function executeGeneration(
  taskId: string,
  body: Record<string, any>,
  count: number,
  updateTask: (id: string, updates: Partial<GenerationTask>) => void,
): Promise<void> {
  updateTask(taskId, { status: "creating", statusDetail: "正在提交请求..." });
  await new Promise((r) => setTimeout(r, 300));

  updateTask(taskId, { status: "generating", statusDetail: `正在生成 ${count} 张图片...` });

  const promises = Array.from({ length: count }, () => callGenerateApi(body));
  const results = await Promise.allSettled(promises);

  const allImages: string[] = [];
  const allThumbs: string[] = [];
  let lastError = "";
  for (const r of results) {
    if (r.status === "fulfilled" && r.value.images) {
      allImages.push(...r.value.images);
      allThumbs.push(...(r.value.thumbnails || r.value.images));
    } else if (r.status === "fulfilled" && r.value.error) {
      lastError = r.value.error;
    } else if (r.status === "rejected") {
      lastError = r.reason?.message || "生成失败";
    }
  }

  updateTask(taskId, { status: "downloading", statusDetail: "正在接收图片数据..." });

  if (allImages.length > 0) {
    updateTask(taskId, { status: "complete", generatedImages: allImages, thumbnails: allThumbs, completedAt: Date.now() });
  } else {
    updateTask(taskId, { status: "error", error: lastError || "未返回图片", completedAt: Date.now() });
  }
}
