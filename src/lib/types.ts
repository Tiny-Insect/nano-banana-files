export type ModelType = "nanobanana-2" | "nanobanana-pro";

export type TaskStatus = "creating" | "generating" | "downloading" | "complete" | "error";

export interface GenerationTask {
  id: string;
  prompt: string;
  referenceImagePreviews: string[];
  referenceImageBase64: string[];
  model: ModelType;
  aspectRatio: string;
  resolution: string;
  numImages: number;
  status: TaskStatus;
  statusDetail?: string;
  generatedImages: string[];
  error?: string;
  createdAt?: number;
  completedAt?: number;
  webSearch?: boolean;
  thinkingLevel?: string;
}

export interface UserSettings {
  customApiUrl: string;
  customApiKey: string;
  downloadPrefix: string;
  downloadFormat: string;
}

export const NANOBANANA2_RATIOS = [
  "1:1", "4:3", "3:4", "16:9", "9:16", "21:9", "3:2", "2:3",
  "4:5", "5:4", "1:4", "4:1", "1:8", "8:1",
];

export const NANOBANANA_PRO_RATIOS = [
  "1:1", "4:3", "3:4", "16:9", "9:16", "21:9", "3:2", "2:3",
];

export const RESOLUTIONS = ["1k", "2k", "4k"] as const;

export const MODEL_INFO: Record<ModelType, { label: string; description: string }> = {
  "nanobanana-2": { label: "NanoBanana 2", description: "高质量生成" },
  "nanobanana-pro": { label: "NanoBanana Pro", description: "快速生成" },
};
