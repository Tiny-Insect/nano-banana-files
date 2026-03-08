import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { GenerationTask, UserSettings } from "./types";

const TASKS_KEY = "nanobanana_tasks";
const SETTINGS_KEY = "nanobanana_settings";
const MAX_TASKS = 20;
const FALLBACK_TASKS = 5;

function loadTasks(): GenerationTask[] {
  try {
    const raw = localStorage.getItem(TASKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveTasks(tasks: GenerationTask[]) {
  const cleaned = tasks.slice(0, MAX_TASKS).map((t) => ({
    ...t,
    referenceImageBase64: [], // clear to save space
  }));
  try {
    localStorage.setItem(TASKS_KEY, JSON.stringify(cleaned));
  } catch {
    // fallback: save fewer
    try {
      localStorage.setItem(TASKS_KEY, JSON.stringify(cleaned.slice(0, FALLBACK_TASKS)));
    } catch {
      // give up
    }
  }
}

function loadSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw
      ? JSON.parse(raw)
      : { customApiUrl: "", customApiKey: "", downloadPrefix: "LumenDust", downloadFormat: "png" };
  } catch {
    return { customApiUrl: "", customApiKey: "", downloadPrefix: "LumenDust", downloadFormat: "png" };
  }
}

function saveSettings(settings: UserSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

interface GenerationContextType {
  tasks: GenerationTask[];
  settings: UserSettings;
  addTask: (task: GenerationTask) => void;
  updateTask: (id: string, updates: Partial<GenerationTask>) => void;
  removeTask: (id: string) => void;
  clearTasks: () => void;
  updateSettings: (s: Partial<UserSettings>) => void;
}

const GenerationContext = createContext<GenerationContextType | null>(null);

export function GenerationProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<GenerationTask[]>(loadTasks);
  const [settings, setSettings] = useState<UserSettings>(loadSettings);

  useEffect(() => saveTasks(tasks), [tasks]);
  useEffect(() => saveSettings(settings), [settings]);

  const addTask = useCallback((task: GenerationTask) => {
    setTasks((prev) => [...prev, task]);
  }, []);

  const updateTask = useCallback((id: string, updates: Partial<GenerationTask>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
  }, []);

  const removeTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearTasks = useCallback(() => setTasks([]), []);

  const updateSettings = useCallback((s: Partial<UserSettings>) => {
    setSettings((prev) => ({ ...prev, ...s }));
  }, []);

  return (
    <GenerationContext.Provider
      value={{ tasks, settings, addTask, updateTask, removeTask, clearTasks, updateSettings }}
    >
      {children}
    </GenerationContext.Provider>
  );
}

export function useGenerationStore() {
  const ctx = useContext(GenerationContext);
  if (!ctx) throw new Error("useGenerationStore must be used within GenerationProvider");
  return ctx;
}
