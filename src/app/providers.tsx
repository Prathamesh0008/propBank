"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/ui/tooltip";
import { Toaster } from "@/ui/toaster";
import { Toaster as Sonner } from "@/ui/sonner";
import { SearchProvider } from "@/contexts/SearchContext";
import { AuthProvider } from "@/contexts/AuthContext";
import PwaRegistration from "@/components/PwaRegistration";

export default function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return <QueryClientProvider client={queryClient}><AuthProvider><TooltipProvider><SearchProvider>
    <Toaster /><Sonner /><PwaRegistration />{children}
  </SearchProvider></TooltipProvider></AuthProvider></QueryClientProvider>;
}
