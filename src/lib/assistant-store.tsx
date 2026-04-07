import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { idbGet, idbSet } from "@/lib/idb";

const electronAPI = (window as any).electronAPI;

export type AssistantMode = "create" | "debug" | "mixed";
export type AssistantActionType = "suggest_only" | "apply" | "apply_and_generate";
export type AssistantRole = "user" | "assistant" | "system";

export interface AssistantMessage {
  id: string;
  role: AssistantRole;
  content: string;
  optimizedPrompt?: string | null;
  suggestedSettings?: {
    model?: string;
    aspectRatio?: string;
    resolution?: string;
    numImages?: number;
    webSearch?: boolean;
    thinkingLevel?: string;
  } | null;
  createdAt: number;
}

export interface AssistantSession {
  id: string;
  title: string;
  mode: AssistantMode;
  createdAt: number;
  updatedAt: number;
  messages: AssistantMessage[];
}

export interface AssistantContextSnapshot {
  prompt: string;
  model: string;
  aspectRatio: string;
  resolution: string;
  numImages: number;
  referenceCount: number;
  referencePreviews: string[];
  webSearch: boolean;
  thinkingLevel: string;
  currentPage: string;
  recentTaskCount: number;
}

interface AssistantState {
  sessions: AssistantSession[];
  activeSessionId: string;
  setActiveSessionId: (id: string) => void;
  createSession: (mode?: AssistantMode) => string;
  appendMessage: (sessionId: string, message: Omit<AssistantMessage, "id" | "createdAt">) => void;
  deleteSession: (sessionId: string) => void;
  renameSession: (sessionId: string, title: string) => void;
}

const STORAGE_KEY = "lumendust_assistant_sessions";
const ACTIVE_KEY = "lumendust_assistant_active_session";
const IDB_SESSIONS_KEY = "sessions";
const IDB_ACTIVE_KEY = "activeSessionId";
const MAX_ASSISTANT_SESSIONS = 40;
const MAX_MESSAGES_PER_SESSION = 100;

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createWelcomeSession(): AssistantSession {
  const now = Date.now();
  return {
    id: createId("session"),
    title: "新对话",
    mode: "mixed",
    createdAt: now,
    updatedAt: now,
    messages: [
      {
        id: createId("msg"),
        role: "assistant",
        content: "我可以帮你整理画面想法、优化提示词，并在你确认后把结果写入提示词输入框。",
        createdAt: now,
      },
    ],
  };
}

function loadSessions(): AssistantSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [createWelcomeSession()];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [createWelcomeSession()];
  } catch {
    return [createWelcomeSession()];
  }
}

function normalizeSessions(sessions: AssistantSession[]): AssistantSession[] {
  return sessions
    .slice(0, MAX_ASSISTANT_SESSIONS)
    .map((session) => ({
      ...session,
      messages: session.messages.slice(-MAX_MESSAGES_PER_SESSION),
    }));
}

function persistSessions(sessions: AssistantSession[]) {
  const normalized = normalizeSessions(sessions);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  } catch {
    const reduced = normalized.slice(0, 12).map((session) => ({
      ...session,
      messages: session.messages.slice(-30),
    }));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(reduced));
      return reduced;
    } catch {
      const fallback = [createWelcomeSession()];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fallback));
      return fallback;
    }
  }
}

async function getChatPersistenceFile() {
  if (!electronAPI?.getAppDataPaths) return null;
  try {
    const paths = await electronAPI.getAppDataPaths();
    return `${paths.chat}/sessions.json`;
  } catch {
    return null;
  }
}

async function getActiveSessionPersistenceFile() {
  if (!electronAPI?.getAppDataPaths) return null;
  try {
    const paths = await electronAPI.getAppDataPaths();
    return `${paths.chat}/active-session.txt`;
  } catch {
    return null;
  }
}

const AssistantContext = createContext<AssistantState | null>(null);

export function AssistantProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<AssistantSession[]>(() => loadSessions());
  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    try {
      return localStorage.getItem(ACTIVE_KEY) || loadSessions()[0].id;
    } catch {
      return loadSessions()[0].id;
    }
  });

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const chatFile = await getChatPersistenceFile();
        const activeFile = await getActiveSessionPersistenceFile();
        let fileSessions: AssistantSession[] | null = null;
        let fileActive: string | null = null;
        if (chatFile && electronAPI?.fsReadFile) {
          const base64 = await electronAPI.fsReadFile(chatFile);
          if (base64) {
            try {
              const text = decodeURIComponent(escape(atob(base64)));
              const parsed = JSON.parse(text);
              if (Array.isArray(parsed)) fileSessions = parsed;
            } catch {
              fileSessions = null;
            }
          }
        }
        if (activeFile && electronAPI?.fsReadFile) {
          const activeBase64 = await electronAPI.fsReadFile(activeFile);
          if (activeBase64) {
            try {
              fileActive = decodeURIComponent(escape(atob(activeBase64)));
            } catch {
              fileActive = null;
            }
          }
        }

        const [idbSessions, idbActive] = await Promise.all([
          idbGet<AssistantSession[]>(IDB_SESSIONS_KEY),
          idbGet<string>(IDB_ACTIVE_KEY),
        ]);
        if (!mounted) return;
        const nextSessions = Array.isArray(fileSessions) && fileSessions.length > 0 ? fileSessions : idbSessions;
        if (Array.isArray(nextSessions) && nextSessions.length > 0) {
          setSessions(normalizeSessions(nextSessions));
        }
        const nextActive = fileActive || idbActive;
        if (typeof nextActive === "string" && nextActive) {
          setActiveSessionId(nextActive);
        }
      } catch {
        // fallback to localStorage only
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const normalized = persistSessions(sessions);
    if (JSON.stringify(normalized) !== JSON.stringify(sessions)) {
      setSessions(normalized);
      return;
    }
    void idbSet(IDB_SESSIONS_KEY, normalized).catch(() => {});
    void (async () => {
      const chatFile = await getChatPersistenceFile();
      if (!chatFile || !electronAPI?.fsWriteFile) return;
      const json = JSON.stringify(normalized);
      const base64 = btoa(unescape(encodeURIComponent(json)));
      await electronAPI.fsWriteFile(chatFile, base64);
    })().catch(() => {});
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem(ACTIVE_KEY, activeSessionId);
    void idbSet(IDB_ACTIVE_KEY, activeSessionId).catch(() => {});
    void (async () => {
      const activeFile = await getActiveSessionPersistenceFile();
      if (!activeFile || !electronAPI?.fsWriteFile) return;
      const base64 = btoa(unescape(encodeURIComponent(activeSessionId)));
      await electronAPI.fsWriteFile(activeFile, base64);
    })().catch(() => {});
  }, [activeSessionId]);

  useEffect(() => {
    if (!sessions.some((s) => s.id === activeSessionId) && sessions[0]) {
      setActiveSessionId(sessions[0].id);
    }
  }, [sessions, activeSessionId]);

  const value = useMemo<AssistantState>(() => ({
    sessions,
    activeSessionId,
    setActiveSessionId,
    createSession: (mode = "mixed") => {
      const now = Date.now();
      const session: AssistantSession = {
        id: createId("session"),
        title: mode === "debug" ? "问题排查" : "新对话",
        mode,
        createdAt: now,
        updatedAt: now,
        messages: [],
      };
      setSessions((prev) => [session, ...prev]);
      setActiveSessionId(session.id);
      return session.id;
    },
    appendMessage: (sessionId, message) => {
      setSessions((prev) => prev.map((session) => {
        if (session.id !== sessionId) return session;
        const nextMessage: AssistantMessage = {
          id: createId("msg"),
          createdAt: Date.now(),
          ...message,
        };
        const nextMessages = [...session.messages, nextMessage];
        const nextTitle = session.title === "新对话" && message.role === "user"
          ? message.content.slice(0, 16) || session.title
          : session.title;
        return {
          ...session,
          title: nextTitle,
          updatedAt: Date.now(),
          messages: nextMessages,
        };
      }));
    },
    deleteSession: (sessionId) => {
      setSessions((prev) => {
        const remaining = prev.filter((session) => session.id !== sessionId);
        return remaining.length > 0 ? remaining : [createWelcomeSession()];
      });
    },
    renameSession: (sessionId, title) => {
      setSessions((prev) => prev.map((session) => (
        session.id === sessionId ? { ...session, title, updatedAt: Date.now() } : session
      )));
    },
  }), [sessions, activeSessionId]);

  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
}

export function useAssistantStore() {
  const context = useContext(AssistantContext);
  if (!context) throw new Error("useAssistantStore must be used within AssistantProvider");
  return context;
}
