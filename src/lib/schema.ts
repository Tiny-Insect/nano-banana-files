import { z } from "zod";

export const generateRequestSchema = z.object({
  model: z.enum(["nanobanana-2", "nanobanana-pro"]),
  prompt: z.string().optional().default(""),
  images: z.array(z.string()).nullable().optional(),
  aspect_ratio: z.string(),
  resolution: z.string(),
  num_images: z.number().min(1).max(4),
  web_search: z.boolean().optional(),
  thinking_level: z.string().optional(),
});

export type GenerateRequest = z.infer<typeof generateRequestSchema>;

export interface GeneratedImage {
  id: number;
  model: string;
  prompt: string;
  aspectRatio: string;
  resolution: string;
  imageUrl: string;
  createdAt: string | null;
}

export const NANOBANANA2_RATIOS = [
  "1:1", "4:3", "3:4", "16:9", "9:16", "21:9", "3:2", "2:3",
  "4:5", "5:4", "1:4", "4:1", "1:8", "8:1",
] as const;

export const NANOBANANA_PRO_RATIOS = [
  "1:1", "4:3", "3:4", "16:9", "9:16", "21:9", "3:2", "2:3",
] as const;

export const RESOLUTIONS = ["1k", "2k", "4k"] as const;
