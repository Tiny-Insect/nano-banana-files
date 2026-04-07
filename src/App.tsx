import { Toaster } from "@/components/ui/toaster";
import DownloadNotificationHost from "@/components/DownloadNotification";
import StarField from "@/components/StarField";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route } from "react-router-dom";
import { queryClient } from "@/lib/queryClient";
import { GenerationProvider } from "@/lib/generation-store";
import { AssistantProvider } from "@/lib/assistant-store";
import ErrorBoundary from "@/components/ErrorBoundary";
import Home from "@/pages/Home";
import Assets from "@/pages/Assets";
import RecentlyDeleted from "@/pages/RecentlyDeleted";
import NotFound from "./pages/NotFound";
import { useEffect } from "react";
import { appLog } from "@/lib/app-log";

const THEME_KEY = "lumendust_theme";

function getInitialTheme(): "dark" | "light" {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {}
  return "dark";
}

export function toggleTheme() {
  const isDark = document.documentElement.classList.contains("dark");
  const next = isDark ? "light" : "dark";
  document.documentElement.classList.remove("dark", "light");
  document.documentElement.classList.add(next);
  localStorage.setItem(THEME_KEY, next);
  window.dispatchEvent(new Event("theme-changed"));
}

export function isDarkMode() {
  return document.documentElement.classList.contains("dark");
}

function App() {
  useEffect(() => {
    const theme = getInitialTheme();
    document.documentElement.classList.remove("dark", "light");
    document.documentElement.classList.add(theme);

    const onError = (event: ErrorEvent) => {
      appLog(`window.error: ${event.message} (${event.filename}:${event.lineno}:${event.colno})`);
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason instanceof Error ? event.reason.stack || event.reason.message : String(event.reason);
      appLog(`window.unhandledrejection: ${reason}`);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <GenerationProvider>
          <AssistantProvider>
            <TooltipProvider>
              <StarField />
              <Toaster />
              <DownloadNotificationHost />
              <HashRouter>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/assets" element={<Assets />} />
                  <Route path="/trash" element={<RecentlyDeleted />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </HashRouter>
            </TooltipProvider>
          </AssistantProvider>
        </GenerationProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
