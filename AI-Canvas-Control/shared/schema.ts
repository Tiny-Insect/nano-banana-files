import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const generatedImages = pgTable("generated_images", {
  id: serial("id").primaryKey(),
  model: varchar("model", { length: 50 }).notNull(),
  prompt: text("prompt").default(""),
  aspectRatio: varchar("aspect_ratio", { length: 20 }).notNull(),
  resolution: varchar("resolution", { length: 10 }).notNull(),
  imageUrl: text("image_url").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertGeneratedImageSchema = createInsertSchema(generatedImages).omit({
  id: true,
  createdAt: true,
});

export type InsertGeneratedImage = z.infer<typeof insertGeneratedImageSchema>;
export type GeneratedImage = typeof generatedImages.$inferSelect;

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

export const NANOBANANA2_RATIOS = [
  "1:1", "4:3", "3:4", "16:9", "9:16", "21:9", "3:2", "2:3",
  "4:5", "5:4", "1:4", "4:1", "1:8", "8:1",
] as const;

export const NANOBANANA_PRO_RATIOS = [
  "1:1", "4:3", "3:4", "16:9", "9:16", "21:9", "3:2", "2:3",
] as const;

export const RESOLUTIONS = ["1k", "2k", "4k"] as const;
