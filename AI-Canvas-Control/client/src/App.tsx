import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { GenerationProvider } from "@/lib/generation-store";
import Home from "@/pages/home";
import Assets from "@/pages/assets";
import NotFound from "@/pages/not-found";
import { useEffect } from "react";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/assets" component={Assets} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <GenerationProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </GenerationProvider>
    </QueryClientProvider>
  );
}

export default App;
