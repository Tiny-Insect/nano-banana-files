import { loadSettings, type AppSettings } from "@/components/Layout";
import { buildOptimizationPrompt, parseOptimizationResult, type ImageOptimizationContext, type ImageOptimizationResult, LUMENDUST_IMAGE_ASSISTANT_SYSTEM_PROMPT } from "@/lib/image-assistant-protocol";

const ASSISTANT_MIN_INTERVAL_MS = 1200;
const ASSISTANT_MAX_RETRIES = 2;

let lastAssistantRequestAt = 0;

class AssistantApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "AssistantApiError";
    this.status = status;
  }
}

export interface AssistantRuntimeInfo {
  provider: "google" | "kimi" | "minimax" | "openai-compatible" | "unconfigured";
  configuredModel: string;
  usingImageApiFallback: boolean;
  available: boolean;
  message: string;
}

type AssistantProvider = Exclude<AssistantRuntimeInfo["provider"], "unconfigured">;

function detectAssistantProvider(rawUrl: string): AssistantProvider {
  const lower = rawUrl.toLowerCase();
  return lower.includes("generativelanguage.googleapis.com") || lower.includes("googleapis.com")
    ? "google"
    : lower.includes("platform.kimi") || lower.includes("moonshot")
      ? "kimi"
      : lower.includes("minimax")
        ? "minimax"
        : "openai-compatible";
}

function normalizeAssistantBaseUrl(rawUrl: string, provider: AssistantProvider): string {
  let baseUrl = rawUrl.replace(/\/+$/, "");

  if (provider === "google") {
    return baseUrl
      .replace(/\/v1beta\/models\/.*$/, "")
      .replace(/\/v1\/models\/.*$/, "")
      .replace(/\/+$/, "");
  }

  if (provider === "minimax") {
    return baseUrl
      .replace(/\/v1\/text\/chatcompletion_v2\/?$/, "")
      .replace(/\/text\/chatcompletion_v2\/?$/, "")
      .replace(/\/v1$/, "")
      .replace(/\/+$/, "");
  }

  return baseUrl
    .replace(/\/v1beta\/openai\/chat\/completions\/?$/, "")
    .replace(/\/v1\/chat\/completions\/?$/, "")
    .replace(/\/chat\/completion\/?$/, "")
    .replace(/\/chat\/completions\/?$/, "")
    .replace(/\/v1$/, "")
    .replace(/\/+$/, "");
}

function resolveAssistantBase(settings: AppSettings = loadSettings()) {
  const assistantUrl = settings.assistantApiUrl.trim();
  const assistantKey = settings.assistantApiKey.trim();
  const imageUrl = settings.customApiUrl.trim();
  const imageKey = settings.customApiKey.trim();
  const configuredModel = (settings.assistantModel || "").trim();
  const hasAssistantUrl = assistantUrl.length > 0;
  const hasAssistantKey = assistantKey.length > 0;

  if (hasAssistantUrl !== hasAssistantKey) {
    throw new Error("助手配置不完整，请同时填写助手 API URL 和助手 API Key；或清空后复用生图配置。");
  }

  const usingImageApiFallback = !hasAssistantUrl && !hasAssistantKey;
  const rawUrl = usingImageApiFallback ? imageUrl : assistantUrl;
  const apiKey = usingImageApiFallback ? imageKey : assistantKey;

  if (!rawUrl || !apiKey) {
    throw new Error("请先在设置里填写助手 API，或留空让助手复用生图配置。");
  }

  const provider = detectAssistantProvider(rawUrl);
  const baseUrl = normalizeAssistantBaseUrl(rawUrl, provider);

  return { rawUrl, baseUrl, apiKey, provider, configuredModel, usingImageApiFallback } as const;
}

function getDefaultAssistantModel(provider: AssistantRuntimeInfo["provider"]): string {
  switch (provider) {
    case "google":
      return "gemini-3.1-pro";
    case "kimi":
      return "kimi-k2.5";
    case "minimax":
      return "MiniMax-M2.7";
    default:
      return "gpt-5.4";
  }
}

export function getAssistantRuntimeInfo(settings: AppSettings = loadSettings()): AssistantRuntimeInfo {
  try {
    const { provider, configuredModel, usingImageApiFallback } = resolveAssistantBase(settings);
    return {
      provider,
      configuredModel: configuredModel || getDefaultAssistantModel(provider),
      usingImageApiFallback,
      available: true,
      message: usingImageApiFallback ? "当前复用生图配置" : "当前使用独立助手配置",
    };
  } catch (error) {
    return {
      provider: "unconfigured",
      configuredModel: settings.assistantModel.trim() || "未配置",
      usingImageApiFallback: false,
      available: false,
      message: formatAssistantErrorMessage(error, settings),
    };
  }
}

export function formatAssistantErrorMessage(error: unknown, settings: AppSettings = loadSettings()): string {
  const assistantConfigured = !!settings.assistantApiUrl.trim() || !!settings.assistantApiKey.trim();

  if (error instanceof DOMException && error.name === "AbortError") {
    return "已停止本次回复";
  }

  if (error instanceof AssistantApiError) {
    if (error.status === 401 || error.status === 403) {
      return "助手 API Key 无效，或当前 Key 没有这个模型的调用权限。";
    }
    if (error.status === 404) {
      return "助手 API 地址或模型名不匹配，请检查 URL 和模型配置。";
    }
    if (error.status === 429) {
      return "助手请求过快，已自动放慢并重试；如果仍失败，请稍后再试。";
    }
    if (typeof error.status === "number" && error.status >= 500) {
      return "助手上游服务暂时不稳定，请稍后再试。";
    }
  }

  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  if (lower.includes("rate increased too quickly") || lower.includes("too many requests")) {
    return "助手请求频率过高，当前上游正在限流，请稍后再试。";
  }
  if (lower.includes("bad gateway") || lower.includes("upstream error")) {
    return "助手上游网关暂时异常，请稍后再试。";
  }
  if (lower.includes("not support") || lower.includes("not supported")) {
    return "当前助手模型不支持这类请求，请更换助手模型或接口。";
  }
  if (lower.includes("请先在设置中填写可用的 api url 和 api key")) {
    return assistantConfigured
      ? "助手配置不完整，请同时填写助手 API URL 和助手 API Key；或清空后复用生图配置。"
      : "请先在设置里填写助手 API，或留空让助手复用生图配置。";
  }

  return message || "助手暂时不可用，请检查助手 API 配置。";
}

async function postJson(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  const text = await response.text();
  if (!response.ok) {
    throw new AssistantApiError(text || `请求失败 (${response.status})`, response.status);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new AssistantApiError(text || "返回内容不是合法 JSON", response.status);
  }
}

async function sleep(ms: number, signal?: AbortSignal) {
  if (ms <= 0) return;

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("The operation was aborted.", "AbortError"));
    };

    if (signal) {
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}

async function enforceAssistantThrottle(signal?: AbortSignal) {
  const now = Date.now();
  const waitMs = ASSISTANT_MIN_INTERVAL_MS - (now - lastAssistantRequestAt);
  if (waitMs > 0) {
    await sleep(waitMs, signal);
  }
  lastAssistantRequestAt = Date.now();
}

function isRetryableAssistantError(error: unknown): boolean {
  if (error instanceof AssistantApiError) {
    if (error.status === 429) return true;
    if (typeof error.status === "number" && error.status >= 500) return true;
  }

  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return message.includes("rate increased too quickly") ||
    message.includes("too many requests") ||
    message.includes("bad gateway") ||
    message.includes("upstream error") ||
    message.includes("temporarily unavailable");
}

async function withRetry<T>(operation: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= ASSISTANT_MAX_RETRIES; attempt += 1) {
    if (signal?.aborted) {
      throw new DOMException("The operation was aborted.", "AbortError");
    }

    try {
      await enforceAssistantThrottle(signal);
      return await operation();
    } catch (error) {
      lastError = error;

      if (signal?.aborted) {
        throw error;
      }

      if (!isRetryableAssistantError(error) || attempt === ASSISTANT_MAX_RETRIES) {
        throw error;
      }

      await sleep(1000 * Math.pow(2, attempt), signal);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("助手请求失败");
}

function extractTextFromGoogleResponse(data: any): string {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts.map((p: any) => p?.text || "").filter(Boolean).join("\n").trim();
}

function extractTextFromOpenAICompatible(data: any): string {
  return data?.choices?.[0]?.message?.content?.trim?.() || "";
}

function extractTextFromKimi(data: any): string {
  return extractTextFromOpenAICompatible(data);
}

function extractTextFromMiniMax(data: any): string {
  return data?.choices?.[0]?.message?.content?.trim?.() || data?.reply?.trim?.() || "";
}

export async function runImageAssistantOptimization(userInput: string, context: ImageOptimizationContext, signal?: AbortSignal, settings?: AppSettings): Promise<ImageOptimizationResult> {
  const { baseUrl, apiKey, provider, configuredModel } = resolveAssistantBase(settings);
  const userPrompt = buildOptimizationPrompt(userInput, context);

  if (provider === "google") {
    const googleModel = configuredModel || "gemini-3.1-pro";
    const url = `${baseUrl}/v1beta/models/${googleModel}:generateContent`;
    const data = await withRetry(() => postJson(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      signal,
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: LUMENDUST_IMAGE_ASSISTANT_SYSTEM_PROMPT },
            { text: userPrompt },
          ],
        }],
      }),
    }), signal);
    return parseOptimizationResult(extractTextFromGoogleResponse(data));
  }

  if (provider === "kimi") {
    const url = `${baseUrl}/v1/chat/completions`;
    const data = await withRetry(() => postJson(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal,
      body: JSON.stringify({
        model: configuredModel || "kimi-k2.5",
        messages: [
          { role: "system", content: LUMENDUST_IMAGE_ASSISTANT_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.6,
      }),
    }), signal);
    return parseOptimizationResult(extractTextFromKimi(data));
  }

  if (provider === "minimax") {
    const url = `${baseUrl}/v1/text/chatcompletion_v2`;
    const data = await withRetry(() => postJson(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal,
      body: JSON.stringify({
        model: configuredModel || "MiniMax-M2.7",
        messages: [
          { role: "system", content: LUMENDUST_IMAGE_ASSISTANT_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.6,
      }),
    }), signal);
    return parseOptimizationResult(extractTextFromMiniMax(data));
  }

  const url = `${baseUrl}/v1/chat/completions`;
  const data = await withRetry(() => postJson(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    signal,
    body: JSON.stringify({
      model: configuredModel || "gpt-5.4",
      messages: [
        { role: "system", content: LUMENDUST_IMAGE_ASSISTANT_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.6,
    }),
  }), signal);
  return parseOptimizationResult(extractTextFromOpenAICompatible(data));
}

export async function testAssistantConnection(signal?: AbortSignal, settings?: AppSettings): Promise<{ ok: true; provider: string; model: string; message: string }> {
  const { baseUrl, apiKey, provider, configuredModel } = resolveAssistantBase(settings);

  if (provider === "google") {
    const model = configuredModel || "gemini-3.1-pro";
    const url = `${baseUrl}/v1beta/models/${model}:generateContent`;
    await withRetry(() => postJson(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Reply with OK only." }] }],
      }),
    }), signal);
    return { ok: true, provider, model, message: "助手连接成功" };
  }

  if (provider === "kimi") {
    const model = configuredModel || "kimi-k2.5";
    const url = `${baseUrl}/v1/chat/completions`;
    await withRetry(() => postJson(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal,
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "Reply with OK only." }],
        temperature: 0,
      }),
    }), signal);
    return { ok: true, provider, model, message: "助手连接成功" };
  }

  if (provider === "minimax") {
    const model = configuredModel || "MiniMax-M2.7";
    const url = `${baseUrl}/v1/text/chatcompletion_v2`;
    await withRetry(() => postJson(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal,
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "Reply with OK only." }],
        temperature: 0,
      }),
    }), signal);
    return { ok: true, provider, model, message: "助手连接成功" };
  }

  const model = configuredModel || "gpt-5.4";
  const url = `${baseUrl}/v1/chat/completions`;
  await withRetry(() => postJson(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    signal,
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: "Reply with OK only." }],
      temperature: 0,
    }),
  }), signal);
  return { ok: true, provider, model, message: "助手连接成功" };
}
