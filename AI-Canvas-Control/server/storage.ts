import { type GeneratedImage, type InsertGeneratedImage, generatedImages } from "@shared/schema";
import { db } from "./db";
import { desc, eq } from "drizzle-orm";

export interface IStorage {
  saveImage(image: InsertGeneratedImage): Promise<GeneratedImage>;
  getImages(limit?: number, offset?: number): Promise<GeneratedImage[]>;
  getImageCount(): Promise<number>;
  deleteImage(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async saveImage(image: InsertGeneratedImage): Promise<GeneratedImage> {
    const [result] = await db.insert(generatedImages).values(image).returning();
    return result;
  }

  async getImages(limit = 50, offset = 0): Promise<GeneratedImage[]> {
    return db.select().from(generatedImages).orderBy(desc(generatedImages.createdAt)).limit(limit).offset(offset);
  }

  async getImageCount(): Promise<number> {
    const result = await db.select().from(generatedImages);
    return result.length;
  }

  async deleteImage(id: number): Promise<void> {
    await db.delete(generatedImages).where(eq(generatedImages.id, id));
  }
}

export const storage = new DatabaseStorage();
