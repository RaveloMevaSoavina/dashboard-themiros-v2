import { createBrowserRouter, Navigate } from "react-router-dom"

import { RootLayout } from "@/app/root-layout"
import { AuthGuard } from "@/features/auth/screens/auth-guard"
import { LoginScreen } from "@/features/auth/screens/login-screen"
import { PublicOnlyRoute } from "@/features/auth/screens/public-only-route"
import { DashboardScreen } from "@/features/dashboard/screens/dashboard-screen"

export const appRouter = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        path: "/",
        element: <Navigate replace to="/login" />,
      },
      {
        element: <PublicOnlyRoute />,
        children: [
          {
            path: "/login",
            element: <LoginScreen />,
          },
        ],
      },
      {
        element: <AuthGuard />,
        children: [
          {
            path: "/dashboard",
            element: <DashboardScreen />,
          },
        ],
      },
      {
        path: "*",
        element: <Navigate replace to="/login" />,
      },
    ],
  },
])
