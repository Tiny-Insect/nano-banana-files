import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-custom-api-url, x-custom-api-key",
};

const MODEL_MAP: Record<string, string> = {
  "nanobanana-2": "gemini-3.1-flash-image-preview",
  "nanobanana-pro": "gemini-3-pro-image-preview",
};

// Note: extractImagesFromResponse was removed to save memory.
// Images are now extracted directly from raw response text via regex
// and uploaded to Storage to avoid OOM with large 4K base64 images.

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      model,
      prompt,
      images,
      image_urls,
      aspect_ratio,
      resolution,
      num_images,
      web_search,
      thinking_level,
    } = body;

    // Combine: prefer image_urls (Storage URLs), fall back to legacy base64 images
    const refImageUrls: string[] = image_urls && image_urls.length > 0 ? image_urls : [];
    const refImageBase64: string[] = !refImageUrls.length && images && images.length > 0 ? images : [];

    // Frontend can override API URL/Key via headers
    const customApiUrl = req.headers.get("x-custom-api-url")?.trim();
    const customApiKey = req.headers.get("x-custom-api-key")?.trim();

    // Resolve API URL: frontend header > env secret
    const rawUrl = customApiUrl || Deno.env.get("NANOBANANA_API_URL") || "";
    const apiKey = customApiKey || Deno.env.get("NANOBANANA_API_KEY") || "";

    if (!rawUrl || !apiKey) {
      return new Response(
        JSON.stringify({ error: "请先在右上角「设置」中填写 API URL 和 API Key，或在 Cloud Secrets 中配置 NANOBANANA_API_URL 和 NANOBANANA_API_KEY" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clean base URL
    const baseUrl = rawUrl
      .replace(/\/v1beta\/models\/.*$/, "")
      .replace(/\/v1beta\/openai\/chat\/completions\/?$/, "")
      .replace(/\/v1\/chat\/completions\/?$/, "")
      .replace(/\/v1\/?$/, "")
      .replace(/\/+$/, "");

    const apiModel = MODEL_MAP[model] || model;
    // Auto-detect: Google native API vs OpenAI-compatible proxy
    // Also detect if the raw URL explicitly uses Gemini endpoints (some proxies support both)
    const isGoogle = baseUrl.includes("generativelanguage.googleapis.com") 
      || baseUrl.includes("googleapis.com")
      || rawUrl.includes("/v1beta/models/")
      || rawUrl.includes(":generateContent");
    console.log("baseUrl:", baseUrl, "isGoogle:", isGoogle, "rawUrl:", rawUrl);

    let chatUrl: string;
    let requestBody: Record<string, any>;
    let reqHeaders: Record<string, string>;

    if (isGoogle) {
      // Google Gemini native API
      chatUrl = `${baseUrl}/v1beta/models/${apiModel}:generateContent`;

      // Build native Gemini content parts
      const parts: any[] = [];
      if (prompt) parts.push({ text: prompt });
      // Google API fileUri only supports gs:// or Files API URIs.
      // For HTTP URLs (e.g. Supabase Storage), fetch and inline as base64.
      if (refImageUrls.length > 0) {
        for (const url of refImageUrls) {
          try {
            const imgResp = await fetch(url);
            if (!imgResp.ok) throw new Error(`Failed to fetch ref image: ${imgResp.status}`);
            const buf = await imgResp.arrayBuffer();
            const bytes = new Uint8Array(buf);
            let binary = "";
            for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
            const b64 = btoa(binary);
            const ct = imgResp.headers.get("content-type") || "image/jpeg";
            parts.push({ inlineData: { mimeType: ct, data: b64 } });
          } catch (e) {
            console.warn("Failed to fetch ref image URL for Google API:", url, e);
          }
        }
        if (!prompt) parts.unshift({ text: "Based on the reference image(s), generate a similar image." });
      }
      // Base64 images sent directly from client
      if (refImageBase64.length > 0) {
        for (const img of refImageBase64) {
          const raw = img.startsWith("data:") ? img.split(",")[1] : img;
          parts.push({ inlineData: { mimeType: "image/png", data: raw } });
        }
        if (!prompt) parts.unshift({ text: "Based on the reference image(s), generate a similar image." });
      }
      if (parts.length === 0) {
        return new Response(
          JSON.stringify({ error: "请提供提示词或参考图" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Map resolution to imageSize
      const imageSizeMap: Record<string, string> = { "1k": "1K", "2k": "2K", "4k": "4K" };
      const imageSize = imageSizeMap[resolution] || "2K";

      // gemini-3-pro-image-preview does NOT support thinkingConfig
      const supportsThinking = apiModel !== "gemini-3-pro-image-preview";

      requestBody = {
        contents: [{ parts }],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
          imageConfig: {
            imageSize,
            ...(aspect_ratio ? { aspectRatio: aspect_ratio } : {}),
          },
          ...(supportsThinking && thinking_level && thinking_level !== "none" ? {
            thinkingConfig: {
              thinkingLevel: thinking_level === "deep" ? "HIGH" : "LOW",
            },
          } : {}),
        },
        ...(web_search ? { tools: [{ googleSearch: {} }] } : {}),
      };

      reqHeaders = {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      };
    } else {
      // Third-party proxy (OpenAI-compatible)
      chatUrl = `${baseUrl}/v1/chat/completions`;

      const contentParts: any[] = [];
      if (prompt) contentParts.push({ type: "text", text: prompt });
      // Use URLs for third-party proxies too
      if (refImageUrls.length > 0) {
        for (const url of refImageUrls) {
          contentParts.push({ type: "image_url", image_url: { url } });
        }
        if (!prompt) contentParts.unshift({ type: "text", text: "Based on the reference image(s), generate a similar image." });
      }
      if (refImageBase64.length > 0) {
        for (const img of refImageBase64) {
          const prefix = img.startsWith("data:") ? img : `data:image/png;base64,${img}`;
          contentParts.push({ type: "image_url", image_url: { url: prefix } });
        }
        if (!prompt) contentParts.unshift({ type: "text", text: "Based on the reference image(s), generate a similar image." });
      }
      if (contentParts.length === 0) {
        return new Response(
          JSON.stringify({ error: "请提供提示词或参考图" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      requestBody = {
        model: apiModel,
        messages: [{ role: "user", content: contentParts }],
        modalities: ["text", "image"],
        // Don't send n>1 here; client already calls API multiple times
      };

      // Try multiple parameter formats for aspect_ratio / image_size
      // Different proxies support different formats
      const imageSize = resolution === "4k" ? "4K" : resolution === "2k" ? "2K" : "1K";
      if (aspect_ratio || resolution) {
        // OpenAI-style (some proxies)
        requestBody.image_config = {
          ...(resolution ? { image_size: imageSize } : {}),
          ...(aspect_ratio ? { aspect_ratio } : {}),
        };
        // Gemini-style via proxy (other proxies)
        requestBody.generation_config = {
          response_modalities: ["Text", "Image"],
          image_generation_config: {
            ...(resolution ? { image_size: imageSize } : {}),
            ...(aspect_ratio ? { aspect_ratio } : {}),
          },
        };
      }
      if (web_search) requestBody.web_search = true;
      if (thinking_level && thinking_level !== "none") requestBody.thinking_level = thinking_level;

      reqHeaders = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      };
    }

    console.log("Request:", chatUrl, "model:", apiModel, "isGoogle:", isGoogle, "webSearch:", web_search, "thinkingLevel:", thinking_level);

    const response = await fetch(chatUrl, {
      method: "POST",
      headers: reqHeaders,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("API error:", response.status, errorText.substring(0, 500));
      const friendlyMessages: Record<number, string> = {
        402: "额度不足，请充值后再试",
        429: "请求过于频繁，请稍等几秒后再试",
        502: "API 服务暂时不可用，请稍后再试",
        503: "API 服务暂时不可用，请稍后再试",
        504: "API 响应超时，请稍后再试",
      };
      const msg =
        friendlyMessages[response.status] ||
        `API 错误 (${response.status}): ${errorText.substring(0, 200)}`;
      return new Response(JSON.stringify({ error: msg }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // CRITICAL: Stream the response directly to the client.
    // 4K images produce ~59MB responses - impossible to buffer in 150MB Edge Function.
    // The frontend will handle base64 extraction and Storage upload.
    console.log("Streaming response to client...");
    
    return new Response(response.body, {
      status: response.status,
      headers: {
        ...corsHeaders,
        "Content-Type": response.headers.get("Content-Type") || "application/json",
      },
    });
  } catch (error: any) {
    console.error("Generate error:", error);
    return new Response(JSON.stringify({ error: error.message || "生成失败" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
