import type { Express } from "express";
import { type Server } from "http";
import { generateRequestSchema } from "@shared/schema";
import { storage } from "./storage";

const MODEL_MAP: Record<string, string> = {
  "nanobanana-2": "gemini-3.1-flash-image-preview",
  "nanobanana-pro": "gemini-3-pro-image-preview",
};

function extractImagesFromResponse(data: any): string[] {
  const images: string[] = [];

  // Official Gemini format
  if (data.candidates && Array.isArray(data.candidates)) {
    for (const candidate of data.candidates) {
      if (candidate.content && Array.isArray(candidate.content.parts)) {
        for (const part of candidate.content.parts) {
          if (part.inline_data && part.inline_data.data) {
            images.push(`data:${part.inline_data.mime_type || "image/png"};base64,${part.inline_data.data}`);
          } else if (part.inlineData && part.inlineData.data) {
            // Some versions use camelCase
            images.push(`data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}`);
          }
        }
      }
    }
  }

  // OpenAI format
  if (data.choices && Array.isArray(data.choices)) {
    for (const choice of data.choices) {
      const msg = choice.message;
      if (!msg) continue;

      const content = msg.content;
      if (!content) continue;

      if (typeof content === "string") {
        const base64Match = content.match(/data:image\/[a-zA-Z]+;base64,[A-Za-z0-9+/=]+/g);
        if (base64Match) {
          images.push(...base64Match);
        }
        continue;
      }

      if (Array.isArray(content)) {
        for (const part of content) {
          if (!part) continue;

          if (part.type === "image_url" && part.image_url?.url) {
            images.push(part.image_url.url);
          } else if (part.type === "image_url" && typeof part.image_url === "string") {
            images.push(part.image_url);
          } else if (part.type === "image" && part.image?.url) {
            images.push(part.image.url);
          } else if (part.type === "image" && part.url) {
            images.push(part.url);
          } else if (part.type === "image" && part.data) {
            images.push(`data:image/png;base64,${part.data}`);
          } else if (part.type === "image" && part.source?.data) {
            images.push(`data:image/${part.source.media_type || "png"};base64,${part.source.data}`);
          } else if (part.b64_json) {
            images.push(`data:image/png;base64,${part.b64_json}`);
          } else if (part.type === "text" && typeof part.text === "string") {
            const b64 = part.text.match(/data:image\/[a-zA-Z]+;base64,[A-Za-z0-9+/=]+/g);
            if (b64) images.push(...b64);
          }
        }
      }
    }
  }

  if (data.data && Array.isArray(data.data)) {
    for (const d of data.data) {
      if (d.url) images.push(d.url);
      if (d.b64_json) images.push(`data:image/png;base64,${d.b64_json}`);
    }
  }

  return images;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.post("/api/generate", async (req, res) => {
    try {
      const parsed = generateRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "参数无效", details: parsed.error.flatten() });
      }

      const { model, prompt, images, aspect_ratio, resolution, num_images, web_search, thinking_level } = parsed.data;

      const customApiUrl = req.headers["x-custom-api-url"] as string | undefined;
      const customApiKey = req.headers["x-custom-api-key"] as string | undefined;

      let rawUrl = process.env.NANOBANANA_API_URL || "";
      if (customApiUrl && customApiUrl.trim()) {
        try {
          const parsed = new URL(customApiUrl.trim());
          if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
            return res.status(400).json({ error: "API URL 必须以 http:// 或 https:// 开头" });
          }
          rawUrl = customApiUrl.trim();
        } catch {
          return res.status(400).json({ error: "自定义 API URL 格式无效" });
        }
      }
      const baseUrl = rawUrl.replace(/\/v1\/chat\/completions\/?$/, "").replace(/\/v1\/images\/generations\/?$/, "").replace(/\/v1\/?$/, "").replace(/\/+$/, "");
      const apiKey = (customApiKey && customApiKey.trim()) || process.env.NANOBANANA_API_KEY;

      if (!baseUrl || !apiKey) {
        return res.status(400).json({ error: "请先在右上角「设置」中填写 API URL 和 API Key" });
      }

      const apiModel = MODEL_MAP[model] || model;

      const contentParts: any[] = [];
      if (prompt) {
        contentParts.push({ type: "text", text: prompt });
      }

      if (images && images.length > 0) {
        for (const img of images) {
          const prefix = img.startsWith("data:") ? img : `data:image/png;base64,${img}`;
          contentParts.push({
            type: "image_url",
            image_url: { url: prefix },
          });
        }
        if (!prompt) {
          contentParts.unshift({ type: "text", text: "Based on the reference image(s), generate a similar image." });
        }
      }

      if (contentParts.length === 0) {
        return res.status(400).json({ error: "请提供提示词或参考图" });
      }

      const resMap: Record<string, string> = { "1k": "1K", "2k": "2K", "4k": "4K" };
      const imageSize = resMap[resolution] || "2K";

      const body: Record<string, any> = {
        model: apiModel,
        messages: [{ role: "user", content: contentParts }],
        modalities: ["text", "image"],
        n: num_images,
        image_config: {
          image_size: resolution === "4k" ? "4K" : resolution === "2k" ? "2K" : "1K",
          aspect_ratio: aspect_ratio,
        },
      };

      // Add redundant configs for compatibility
      body.generation_config = {
        response_modalities: ["Text", "Image"],
        image_generation_config: {
          image_size: resolution === "4k" ? "4K" : resolution === "2k" ? "2K" : "1K",
          aspect_ratio: aspect_ratio,
        },
      };

      // Web search and thinking level
      if (web_search) body.web_search = true;
      if (thinking_level) body.thinking_level = thinking_level;

      // Build final URL
      const chatUrl = `${baseUrl}/v1/chat/completions`;
      
      console.log("Request:", chatUrl, "model:", apiModel);

      const response = await fetch(chatUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("API error:", response.status, errorText.substring(0, 500));
        const friendlyMessages: Record<number, string> = {
          429: "请求过于频繁，请稍等几秒后再试",
          502: "API 服务暂时不可用，请稍后再试",
          503: "API 服务暂时不可用，请稍后再试",
          504: "API 响应超时，请稍后再试",
        };
        const msg = friendlyMessages[response.status] || `API 错误 (${response.status}): ${errorText.substring(0, 200)}`;
        return res.status(response.status).json({ error: msg });
      }

      const data = await response.json();
      console.log("Full API Response:", JSON.stringify(data, null, 2));

      // Check for content-filter-style blocks or empty responses from official API
      if (isOfficial && data.candidates && data.candidates[0]?.finishReason === "SAFETY") {
        return res.status(400).json({ error: "请求被安全过滤器拦截，请尝试修改提示词" });
      }

      const resultImages = extractImagesFromResponse(data);
      console.log("Extracted images:", resultImages.length);

      for (const imgUrl of resultImages) {
        try {
          await storage.saveImage({
            model,
            prompt: prompt || "",
            aspectRatio: aspect_ratio,
            resolution,
            imageUrl: imgUrl,
          });
        } catch (e) {
          console.error("Failed to save image:", e);
        }
      }

      return res.json({ images: resultImages, raw: resultImages.length === 0 ? data : undefined });
    } catch (error: any) {
      console.error("Generate error:", error);
      return res.status(500).json({ error: error.message || "生成失败" });
    }
  });

  app.get("/api/images", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const imgList = await storage.getImages(limit, offset);
      const count = await storage.getImageCount();
      return res.json({ images: imgList, total: count });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/images/:id", async (req, res) => {
    try {
      await storage.deleteImage(parseInt(req.params.id));
      return res.json({ success: true });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  return httpServer;
}
