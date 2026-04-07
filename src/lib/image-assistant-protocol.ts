export interface ImageOptimizationContext {
  prompt: string;
  model: string;
  aspectRatio: string;
  resolution: string;
  referenceCount: number;
  webSearch: boolean;
  thinkingLevel: string;
}

export interface ImageOptimizationResult {
  reply: string;
  optimizedPrompt: string | null;
  suggestedSettings: {
    model?: string;
    aspectRatio?: string;
    resolution?: string;
    numImages?: number;
    webSearch?: boolean;
    thinkingLevel?: string;
  } | null;
  reasoning: string;
}

export const LUMENDUST_IMAGE_ASSISTANT_SYSTEM_PROMPT = `你是 LumenDust 的图片创作助手。你的任务是帮助用户优化图片生成提示词、调整参数、排查出图问题。

请始终遵循以下原则：
1. 优先关注画面主体、构图、镜头感、风格、材质、光线、背景、用途
2. 输出简洁、专业、可直接用于图片生成的提示词
3. 如果用户描述模糊，先追问关键细节，不要瞎编
4. 不要输出过多工程化解释，聚焦在创作本身
5. 如果用户遇到出图问题，先分析当前参数组合，再给出调整建议

请始终以结构化方式思考，但回复要自然流畅。`;

export function buildOptimizationPrompt(userInput: string, context: ImageOptimizationContext): string {
  const contextBlock = `当前状态：
- 提示词：${context.prompt || "（空）"}
- 模型：${context.model}
- 比例：${context.aspectRatio}
- 分辨率：${context.resolution.toUpperCase()}
- 参考图：${context.referenceCount} 张
- 联网搜索：${context.webSearch ? "开" : "关"}
- 思考模式：${context.thinkingLevel === "deep" ? "深度" : context.thinkingLevel === "none" ? "关" : "快速"}`;

  return `${contextBlock}

用户需求：${userInput}

请根据以上信息，给出：
1. 一段自然回复（reply）
2. 优化后的提示词（如果没有需要优化则留空）
3. 参数调整建议（如果有）
4. 简要说明你的思路`;
}

export function parseOptimizationResult(rawText: string): ImageOptimizationResult {
  const lines = rawText.split("\n");
  let reply = "";
  let optimizedPrompt: string | null = null;
  let reasoning = "";
  let settingsText = "";

  let section: "reply" | "prompt" | "settings" | "reasoning" = "reply";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("1.") || trimmed.toLowerCase().includes("回复")) {
      section = "reply";
      const content = trimmed.replace(/^1\.\s*/, "").replace(/^回复[：:]\s*/, "");
      if (content) reply += content + "\n";
    } else if (trimmed.startsWith("2.") || trimmed.toLowerCase().includes("提示词") || trimmed.toLowerCase().includes("optimized")) {
      section = "prompt";
      const content = trimmed.replace(/^2\.\s*/, "").replace(/^优化后的提示词[：:]\s*/, "");
      if (content) optimizedPrompt = content;
    } else if (trimmed.startsWith("3.") || trimmed.toLowerCase().includes("参数") || trimmed.toLowerCase().includes("settings")) {
      section = "settings";
    } else if (trimmed.startsWith("4.") || trimmed.toLowerCase().includes("思路") || trimmed.toLowerCase().includes("reasoning")) {
      section = "reasoning";
      const content = trimmed.replace(/^4\.\s*/, "").replace(/^思路[：:]\s*/, "");
      if (content) reasoning += content + "\n";
    } else {
      switch (section) {
        case "reply":
          reply += line + "\n";
          break;
        case "prompt":
          optimizedPrompt = (optimizedPrompt || "") + line + "\n";
          break;
        case "reasoning":
          reasoning += line + "\n";
          break;
        case "settings":
          settingsText += line + "\n";
          break;
      }
    }
  }

  const mergedSettingsText = settingsText.trim();
  const suggestedSettings = mergedSettingsText
    ? {
        model: mergedSettingsText.match(/(?:模型|model)[：:\s]+([^\n,，]+)/i)?.[1]?.trim(),
        aspectRatio: mergedSettingsText.match(/(?:比例|aspect\s*ratio)[：:\s]+(1:1|5:4|4:3|3:2|16:9|21:9|4:1|8:1|4:5|3:4|2:3|9:16|1:4|1:8)/i)?.[1],
        resolution: mergedSettingsText.match(/(?:分辨率|resolution)[：:\s]+(1k|2k|4k)/i)?.[1]?.toLowerCase(),
        numImages: mergedSettingsText.match(/(?:张数|数量|num\s*images?)[：:\s]+([1-4])/i)?.[1] ? Number(mergedSettingsText.match(/(?:张数|数量|num\s*images?)[：:\s]+([1-4])/i)?.[1]) : undefined,
        webSearch: /(?:联网搜索|web\s*search)[：:\s]+(开|开启|on|true)/i.test(mergedSettingsText)
          ? true
          : /(?:联网搜索|web\s*search)[：:\s]+(关|关闭|off|false)/i.test(mergedSettingsText)
            ? false
            : undefined,
        thinkingLevel: mergedSettingsText.match(/(?:思考模式|thinking(?:\s*level)?)[：:\s]+(fast|deep|none|快速|深度|关闭|关)/i)?.[1],
      }
    : null;

  const normalizedThinkingLevel = suggestedSettings?.thinkingLevel
    ? ({ "快速": "fast", "深度": "deep", "关闭": "none", "关": "none" } as Record<string, string>)[suggestedSettings.thinkingLevel] || suggestedSettings.thinkingLevel.toLowerCase()
    : undefined;

  return {
    reply: reply.trim() || rawText.trim(),
    optimizedPrompt: optimizedPrompt?.trim() || null,
    suggestedSettings: suggestedSettings ? {
      ...suggestedSettings,
      thinkingLevel: normalizedThinkingLevel,
    } : null,
    reasoning: reasoning.trim(),
  };
}
