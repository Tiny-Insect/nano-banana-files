import { Toaster } from "@/components/ui/toaster";
import StarField from "@/components/StarField";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { queryClient } from "@/lib/queryClient";
import { GenerationProvider } from "@/lib/generation-store";
import Home from "@/pages/Home";
import Assets from "@/pages/Assets";
import NotFound from "./pages/NotFound";
import { useEffect } from "react";

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
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <GenerationProvider>
        <TooltipProvider>
          <Toaster />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/assets" element={<Assets />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </GenerationProvider>
    </QueryClientProvider>
  );
}

export default App;
