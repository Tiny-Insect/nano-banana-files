import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-custom-api-url, x-custom-api-key",
};

const LOVABLE_AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

// Model mapping for custom API endpoints (non-gateway)
const MODEL_MAP_CUSTOM: Record<string, string> = {
  "nanobanana-2": "gemini-3.1-flash-image-preview",
  "nanobanana-pro": "gemini-3-pro-image-preview",
};

// Model mapping for Lovable AI Gateway
const MODEL_MAP_GATEWAY: Record<string, string> = {
  "nanobanana-2": "google/gemini-3.1-flash-image-preview",
  "nanobanana-pro": "google/gemini-3-pro-image-preview",
};

function extractImagesFromResponse(data: any): string[] {
  const images: string[] = [];

  // Official Gemini format
  if (data.candidates && Array.isArray(data.candidates)) {
    for (const candidate of data.candidates) {
      if (candidate.content && Array.isArray(candidate.content.parts)) {
        for (const part of candidate.content.parts) {
          if (part.inline_data && part.inline_data.data) {
            images.push(
              `data:${part.inline_data.mime_type || "image/png"};base64,${part.inline_data.data}`
            );
          } else if (part.inlineData && part.inlineData.data) {
            images.push(
              `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}`
            );
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
        const base64Match = content.match(
          /data:image\/[a-zA-Z]+;base64,[A-Za-z0-9+/=]+/g
        );
        if (base64Match) images.push(...base64Match);
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
            images.push(
              `data:image/${part.source.media_type || "png"};base64,${part.source.data}`
            );
          } else if (part.b64_json) {
            images.push(`data:image/png;base64,${part.b64_json}`);
          } else if (part.type === "text" && typeof part.text === "string") {
            const b64 = part.text.match(
              /data:image\/[a-zA-Z]+;base64,[A-Za-z0-9+/=]+/g
            );
            if (b64) images.push(...b64);
          }
        }
      }
    }
  }

  // images/generations format
  if (data.data && Array.isArray(data.data)) {
    for (const d of data.data) {
      if (d.url) images.push(d.url);
      if (d.b64_json) images.push(`data:image/png;base64,${d.b64_json}`);
    }
  }

  return images;
}

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
      aspect_ratio,
      resolution,
      num_images,
      web_search,
      thinking_level,
    } = body;

    const customApiUrl = req.headers.get("x-custom-api-url");
    const customApiKey = req.headers.get("x-custom-api-key");

    // Determine if using custom API or Lovable AI Gateway
    const useCustom = !!(customApiUrl?.trim() || Deno.env.get("NANOBANANA_API_URL")?.trim());
    let chatUrl: string;
    let apiKey: string;
    let apiModel: string;

    if (useCustom) {
      // Custom API mode
      let rawUrl = Deno.env.get("NANOBANANA_API_URL") || "";
      if (customApiUrl && customApiUrl.trim()) {
        try {
          const parsed = new URL(customApiUrl.trim());
          if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
            return new Response(
              JSON.stringify({ error: "API URL 必须以 http:// 或 https:// 开头" }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          rawUrl = customApiUrl.trim();
        } catch {
          return new Response(
            JSON.stringify({ error: "自定义 API URL 格式无效" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      const baseUrl = rawUrl
        .replace(/\/v1beta\/openai\/chat\/completions\/?$/, "")
        .replace(/\/v1\/chat\/completions\/?$/, "")
        .replace(/\/v1\/images\/generations\/?$/, "")
        .replace(/\/v1\/?$/, "")
        .replace(/\/+$/, "");

      apiKey = (customApiKey && customApiKey.trim()) || Deno.env.get("NANOBANANA_API_KEY") || "";

      if (!baseUrl || !apiKey) {
        return new Response(
          JSON.stringify({ error: "请先在右上角「设置」中填写 API URL 和 API Key" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Detect Google AI Studio and use correct path
      if (baseUrl.includes("generativelanguage.googleapis.com")) {
        chatUrl = `${baseUrl}/v1beta/openai/chat/completions`;
      } else {
        chatUrl = `${baseUrl}/v1/chat/completions`;
      }

      apiModel = MODEL_MAP_CUSTOM[model] || model;
    } else {
      // Lovable AI Gateway mode (default)
      const lovableKey = Deno.env.get("LOVABLE_API_KEY");
      if (!lovableKey) {
        return new Response(
          JSON.stringify({ error: "LOVABLE_API_KEY 未配置，请启用 Lovable Cloud" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      chatUrl = LOVABLE_AI_GATEWAY;
      apiKey = lovableKey;
      apiModel = MODEL_MAP_GATEWAY[model] || model;
    }

    // Build content parts
    const contentParts: any[] = [];
    if (prompt) {
      contentParts.push({ type: "text", text: prompt });
    }
    if (images && images.length > 0) {
      for (const img of images) {
        const prefix = img.startsWith("data:") ? img : `data:image/png;base64,${img}`;
        contentParts.push({ type: "image_url", image_url: { url: prefix } });
      }
      if (!prompt) {
        contentParts.unshift({
          type: "text",
          text: "Based on the reference image(s), generate a similar image.",
        });
      }
    }
    if (contentParts.length === 0) {
      return new Response(
        JSON.stringify({ error: "请提供提示词或参考图" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const requestBody: Record<string, any> = {
      model: apiModel,
      messages: [{ role: "user", content: contentParts }],
      modalities: ["text", "image"],
      n: num_images || 1,
    };

    // Only add these fields for custom API (not Lovable AI Gateway)
    if (useCustom) {
      requestBody.image_config = {
        image_size: resolution === "4k" ? "4K" : resolution === "2k" ? "2K" : "1K",
        aspect_ratio: aspect_ratio,
      };
      requestBody.generation_config = {
        response_modalities: ["Text", "Image"],
        image_generation_config: {
          image_size: resolution === "4k" ? "4K" : resolution === "2k" ? "2K" : "1K",
          aspect_ratio: aspect_ratio,
        },
      };
      if (web_search) requestBody.web_search = true;
      if (thinking_level) requestBody.thinking_level = thinking_level;
    }

    console.log("Request:", chatUrl, "model:", apiModel);

    const response = await fetch(chatUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
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

    const data = await response.json();
    console.log("API response received, extracting images...");

    // Safety filter check
    if (data.candidates && data.candidates[0]?.finishReason === "SAFETY") {
      return new Response(
        JSON.stringify({ error: "请求被安全过滤器拦截，请尝试修改提示词" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resultImages = extractImagesFromResponse(data);
    console.log("Extracted images:", resultImages.length);

    return new Response(
      JSON.stringify({
        images: resultImages,
        raw: resultImages.length === 0 ? data : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Generate error:", error);
    return new Response(JSON.stringify({ error: error.message || "生成失败" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
