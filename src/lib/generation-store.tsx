import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

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
  thumbnails: string[];
  error?: string;
  createdAt?: number;
  completedAt?: number;
  webSearch?: boolean;
  thinkingLevel?: string;
}

const TASKS_STORAGE_KEY = "nanobanana_tasks";
const MAX_STORED_TASKS = 100;
const PAGE_SIZE = 20;

function loadTasks(): GenerationTask[] {
  try {
    const raw = localStorage.getItem(TASKS_STORAGE_KEY);
    if (!raw) return [];
    const tasks = JSON.parse(raw) as GenerationTask[];
    return tasks.map((t) => ({
      ...t,
      thumbnails: t.thumbnails || [],
      status: (t.generatedImages && t.generatedImages.length > 0) ? "complete" : (t.status === "complete" || t.status === "error" ? t.status : "error" as TaskStatus),
      error: (t.status !== "complete" && t.status !== "error" && (!t.generatedImages || t.generatedImages.length === 0)) ? "页面刷新后任务中断" : t.error,
    }));
  } catch {
    return [];
  }
}

function saveTasks(tasks: GenerationTask[]) {
  try {
    const toSave = tasks.slice(-MAX_STORED_TASKS).map((t) => ({
      ...t,
      referenceImageBase64: (t.referenceImageBase64 || []).filter(img => img.startsWith("http") || img.startsWith("local-file://")),
      referenceImagePreviews: (t.referenceImagePreviews || []).filter(img => img.startsWith("http") || img.startsWith("local-file://")),
      generatedImages: (t.generatedImages || []).filter((img) => img.startsWith("http") || img.startsWith("local-file://")),
      thumbnails: (t.thumbnails || []).filter((img) => img.startsWith("http") || img.startsWith("local-file://")),
    }));
    localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(toSave));
  } catch (e) {
    console.warn("Failed to save tasks to localStorage:", e);
    try {
      const minimal = tasks.slice(-10).map(t => ({
        ...t,
        referenceImageBase64: [],
        referenceImagePreviews: [],
        generatedImages: [],
        thumbnails: [],
      }));
      localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(minimal));
    } catch {
      try { localStorage.removeItem(TASKS_STORAGE_KEY); } catch {}
    }
  }
}

/** Create a thumbnail blob from an image blob using canvas */
export async function createThumbnail(blob: Blob, maxSize = 280): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const { width, height } = img;
      const scale = Math.min(maxSize / width, maxSize / height, 1);
      const w = Math.round(width * scale);
      const h = Math.round(height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas not supported")); return; }
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (b) => b ? resolve(b) : reject(new Error("toBlob failed")),
        "image/jpeg",
        0.75
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image load failed")); };
    img.src = url;
  });
}

interface GenerationState {
  model: ModelType;
  prompt: string;
  referenceImages: string[];
  referenceImagePreviews: string[];
  aspectRatio: string;
  resolution: string;
  numImages: number;
  webSearch: boolean;
  thinkingLevel: string;
  tasks: GenerationTask[];
  visibleCount: number;
  lightboxImage: string | null;
  setModel: (m: ModelType) => void;
  setPrompt: (p: string) => void;
  setReferenceImages: React.Dispatch<React.SetStateAction<string[]>>;
  setReferenceImagePreviews: React.Dispatch<React.SetStateAction<string[]>>;
  setAspectRatio: (r: string) => void;
  setResolution: (r: string) => void;
  setNumImages: (n: number) => void;
  setWebSearch: (w: boolean) => void;
  setThinkingLevel: (t: string) => void;
  setTasks: React.Dispatch<React.SetStateAction<GenerationTask[]>>;
  setLightboxImage: (img: string | null) => void;
  addTask: (task: GenerationTask) => void;
  updateTask: (id: string, updates: Partial<GenerationTask>) => void;
  loadMore: () => void;
  hasMore: boolean;
  clearOldTasks: (keepLast: number) => void;
}

const GenerationContext = createContext<GenerationState | null>(null);

export function GenerationProvider({ children }: { children: ReactNode }) {
  const [model, setModel] = useState<ModelType>("nanobanana-2");
  const [prompt, setPrompt] = useState("");
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [referenceImagePreviews, setReferenceImagePreviews] = useState<string[]>([]);
  const [aspectRatio, setAspectRatio] = useState("9:16");
  const [resolution, setResolution] = useState("2k");
  const [numImages, setNumImages] = useState(1);
  const [webSearch, setWebSearch] = useState(true);
  const [thinkingLevel, setThinkingLevel] = useState("deep");
  const [tasks, setTasks] = useState<GenerationTask[]>(() => loadTasks());
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    saveTasks(tasks);
  }, [tasks]);

  const addTask = useCallback((task: GenerationTask) => {
    setTasks((prev) => [...prev, { ...task, thumbnails: task.thumbnails || [] }]);
  }, []);

  const updateTask = useCallback((id: string, updates: Partial<GenerationTask>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
  }, []);

  const loadMore = useCallback(() => {
    setVisibleCount((prev) => prev + PAGE_SIZE);
  }, []);

  const hasMore = visibleCount < tasks.length;

  const clearOldTasks = useCallback((keepLast: number) => {
    setTasks((prev) => prev.slice(-keepLast));
  }, []);

  return (
    <GenerationContext.Provider
      value={{
        model, setModel,
        prompt, setPrompt,
        referenceImages, setReferenceImages,
        referenceImagePreviews, setReferenceImagePreviews,
        aspectRatio, setAspectRatio,
        resolution, setResolution,
        numImages, setNumImages,
        webSearch, setWebSearch,
        thinkingLevel, setThinkingLevel,
        tasks, setTasks,
        lightboxImage, setLightboxImage,
        visibleCount,
        addTask, updateTask,
        loadMore, hasMore,
        clearOldTasks,
      }}
    >
      {children}
    </GenerationContext.Provider>
  );
}

export function useGenerationStore() {
  const ctx = useContext(GenerationContext);
  if (!ctx) throw new Error("useGenerationStore must be inside GenerationProvider");
  return ctx;
}
