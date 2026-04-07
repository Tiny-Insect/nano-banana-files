/**
 * Shared API utilities for generation calls.
 * Eliminates duplication between Home.tsx and Assets.tsx.
 */

import { supabase, hasSupabaseConfig } from "@/integrations/supabase/client";
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

  const parseLocalPath = (pathname: string): string => {
    const decoded = decodeURIComponent(pathname);
    // Windows style in URL path: /C:/Users/... -> C:/Users/...
    if (/^\/[A-Za-z]:\//.test(decoded)) return decoded.slice(1);
    // POSIX path: /Users/... or /home/... stays as-is
    return decoded;
  };

  for (const url of urls) {
    if (url.startsWith("local-file://")) {
      // Read local file and convert to base64
      try {
        const parsed = new URL(url);
        const localPath = parseLocalPath(parsed.pathname);
        if (electronAPI?.fsReadFile) {
          const base64 = await electronAPI.fsReadFile(localPath);
          if (typeof base64 === "string" && base64.length > 0) {
            images.push(base64);
          } else {
            console.warn("Failed to read local-file for API (empty result):", url);
          }
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

export function getCustomApiHeaders(settings = loadSettings()): Record<string, string> {
  const headers: Record<string, string> = {};
  if (settings.customApiUrl.trim()) headers["X-Custom-Api-Url"] = settings.customApiUrl.trim();
  if (settings.customApiKey.trim()) headers["X-Custom-Api-Key"] = settings.customApiKey.trim();
  return headers;
}

async function callDirectImageApi(body: Record<string, any>, settings = loadSettings()): Promise<any> {
  const rawUrl = settings.customApiUrl.trim();
  const apiKey = settings.customApiKey.trim();
  if (!rawUrl || !apiKey) {
    throw new Error("请先填写图片 API URL 和 Key");
  }

  const baseUrl = rawUrl
    .replace(/\/v1beta\/models\/.*$/, "")
    .replace(/\/v1beta\/openai\/chat\/completions\/?$/, "")
    .replace(/\/v1\/chat\/completions\/?$/, "")
    .replace(/\/v1\/?$/, "")
    .replace(/\/+$/, "");

  const modelMap: Record<string, string> = {
    "nanobanana-2": "gemini-3.1-flash-image-preview",
    "nanobanana-pro": "gemini-3-pro-image-preview",
  };
  const apiModel = modelMap[body.model] || body.model;
  const isGoogle = baseUrl.includes("generativelanguage.googleapis.com") || baseUrl.includes("googleapis.com") || rawUrl.includes(":generateContent");

  if (isGoogle) {
    const parts: any[] = [];
    if (body.prompt) parts.push({ text: body.prompt });
    for (const url of body.image_urls || []) {
      const imgResp = await fetch(url);
      const buf = await imgResp.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const b64 = btoa(binary);
      const ct = imgResp.headers.get("content-type") || "image/jpeg";
      parts.push({ inlineData: { mimeType: ct, data: b64 } });
    }
    for (const img of body.images || []) {
      const raw = img.startsWith("data:") ? img.split(",")[1] : img;
      parts.push({ inlineData: { mimeType: "image/png", data: raw } });
    }
    const response = await fetch(`${baseUrl}/v1beta/models/${apiModel}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({ contents: [{ parts }] }),
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  }

  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: apiModel,
      messages: [{ role: "user", content: body.prompt || "Generate image" }],
      stream: false,
    }),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function testImageApiConnection(settings = loadSettings()): Promise<{ ok: true; message: string }> {
  if (settings.customApiUrl.trim() && settings.customApiKey.trim()) {
    await callDirectImageApi({ model: "nanobanana-2", prompt: "ping" }, settings);
    return { ok: true, message: "图片 API 连接成功" };
  }
  if (!supabase || !hasSupabaseConfig) {
    throw new Error("请先填写图片 API URL 和 Key");
  }
  const customHeaders = getCustomApiHeaders(settings);
  const { data, error } = await supabase.functions.invoke("generate", {
    body: {
      model: "nanobanana-2",
      prompt: "ping",
      aspect_ratio: "1:1",
      resolution: "1k",
      num_images: 1,
      web_search: false,
      thinking_level: "fast",
      dry_run: true,
    },
    headers: customHeaders,
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return { ok: true, message: "图片 API 连接成功" };
}

export async function callGenerateApi(body: Record<string, any>): Promise<any> {
  const settings = loadSettings();
  if (!supabase || !hasSupabaseConfig) {
    return callDirectImageApi(body, settings);
  }
  const customHeaders = getCustomApiHeaders(settings);
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
              let stored: any;
              try {
                stored = await storage.saveGeneratedImage(blob, mimeType);
              } catch (firstErr) {
                console.warn("First save attempt failed, retrying in 1s...", firstErr);
                await new Promise(r => setTimeout(r, 1000));
                stored = await storage.saveGeneratedImage(blob, mimeType);
              }
              images.push(stored.originalUrl);
              thumbnails.push(stored.thumbnailUrl);
            } catch (saveErr) {
              console.warn("Image save failed after retry, using data URL fallback:", saveErr);
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
    if (s.downloadPath) return s.downloadPath;
    if (storage.getMode() === "desktop" && (window as any).electronAPI?.getAppDataPaths) {
      const paths = await (window as any).electronAPI.getAppDataPaths();
      return paths.downloads;
    }
    return storage.getMode() === "web" ? "浏览器下载目录" : undefined;
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

  // Post-processing: rescue any data: URLs by retrying storage save
  const storage = getStorage();
  for (let i = 0; i < allImages.length; i++) {
    if (allImages[i].startsWith("data:")) {
      try {
        const blob = await fetch(allImages[i]).then(r => r.blob());
        const mimeMatch = allImages[i].match(/^data:([^;]+);/);
        const mime = mimeMatch ? mimeMatch[1] : "image/png";
        const stored = await storage.saveGeneratedImage(blob, mime);
        allImages[i] = stored.originalUrl;
        allThumbs[i] = stored.thumbnailUrl;
        console.log("Post-process: rescued data URL to", stored.originalUrl);
      } catch (e) {
        console.warn("Post-process: failed to rescue data URL at index", i, e);
      }
    }
  }

  if (allImages.length > 0) {
    updateTask(taskId, { status: "complete", generatedImages: allImages, thumbnails: allThumbs, completedAt: Date.now() });
  } else {
    updateTask(taskId, { status: "error", error: lastError || "未返回图片", completedAt: Date.now() });
  }
}
