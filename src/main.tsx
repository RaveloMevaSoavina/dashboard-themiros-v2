import { QueryClientProvider } from "@tanstack/react-query"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { Toaster } from "sonner"

import { AuthProvider } from "@/features/auth/model/auth-provider"
import { queryClient } from "@/shared/lib/query-client"
import { TooltipProvider } from "@/shared/ui/base/tooltip"
import "./index.css"
import "@/shared/i18n"
import App from "./App.tsx"

const rootElement = document.getElementById("root")

if (!rootElement) {
  throw new Error("Root element #root was not found")
}

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <App />
          <Toaster closeButton position="top-right" richColors />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>
)
