import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { queryClient } from "@/lib/queryClient";
import { GenerationProvider } from "@/lib/generation-store";
import Home from "@/pages/Home";
import Assets from "@/pages/Assets";
import NotFound from "./pages/NotFound";
import { useEffect } from "react";

function App() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
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
