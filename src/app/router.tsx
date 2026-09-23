import { createBrowserRouter, Navigate } from "react-router-dom"

import { RootLayout } from "@/app/root-layout"
import { AuthGuard } from "@/features/auth/screens/auth-guard"
import { LoginScreen } from "@/features/auth/screens/login-screen"
import { ProfileScreen } from "@/features/auth/screens/profile-screen"
import { PublicOnlyRoute } from "@/features/auth/screens/public-only-route"
import { CorpusInventoryScreen } from "@/features/corpus/screens/corpus-inventory-screen"
import { DocumentDetailScreen } from "@/features/corpus/screens/document-detail-screen"
import { DocumentsReviewScreen } from "@/features/corpus/screens/documents-review-screen"
import { ImportDocumentsScreen } from "@/features/corpus/screens/import-documents-screen"
import { navSections } from "@/features/dashboard/model/navigation"
import { DashboardLayout } from "@/features/dashboard/screens/dashboard-layout"
import { PlaceholderScreen } from "@/features/dashboard/screens/placeholder-screen"
import { CreateWorkspaceScreen } from "@/features/workspaces/screens/create-workspace-screen"
import { WorkspaceAccessLayout } from "@/features/workspaces/screens/workspace-access-layout"
import { WorkspaceProviderLayout } from "@/features/workspaces/screens/workspace-provider-layout"
import { WorkspaceRedirect } from "@/features/workspaces/screens/workspace-redirect"
import { WorkspaceSettingsScreen } from "@/features/workspaces/screens/workspace-settings-screen"
import { WorkspacesScreen } from "@/features/workspaces/screens/workspaces-screen"

/**
 * Les routes d'espace derivent du meme modele que la barre laterale : une
 * entree de navigation ne peut donc pas pointer vers une route absente.
 */
const workspaceRoutes = navSections.flatMap((section) =>
  section.items.map((item) => ({
    path: item.segment,
    children: [
      {
        index: true,
        element:
          item.segment === "corpus" ? (
            <CorpusInventoryScreen />
          ) : item.segment === "settings" ? (
            <WorkspaceSettingsScreen />
          ) : (
            <PlaceholderScreen labelKey={item.labelKey} />
          ),
      },
      ...(item.children ?? []).map((child) => ({
        path: child.segment,
        element:
          item.segment === "corpus" && child.segment === "import" ? (
            <ImportDocumentsScreen />
          ) : item.segment === "corpus" && child.segment === "documents" ? (
            <DocumentsReviewScreen />
          ) : item.segment === "corpus" && child.segment === "inventory" ? (
            <CorpusInventoryScreen />
          ) : item.segment === "settings" && child.segment === "general" ? (
            <WorkspaceSettingsScreen />
          ) : (
            <PlaceholderScreen labelKey={child.labelKey} />
          ),
      })),
      ...(item.segment === "corpus"
        ? [
            {
              path: "documents/:documentId",
              element: <DocumentDetailScreen />,
            },
          ]
        : []),
    ],
  }))
)

export const appRouter = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        path: "/",
        element: <Navigate replace to="/workspaces" />,
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
            element: <WorkspaceProviderLayout />,
            children: [
              {
                element: <WorkspaceAccessLayout />,
                children: [
                  {
                    path: "/workspaces/new",
                    element: <CreateWorkspaceScreen />,
                  },
                  {
                    element: <DashboardLayout />,
                    children: [
                      {
                        path: "/workspaces",
                        element: <WorkspacesScreen />,
                      },
                      {
                        path: "/profile",
                        element: <ProfileScreen />,
                      },
                      {
                        path: "/workspaces/:workspaceId",
                        children: [
                          { index: true, element: <WorkspaceRedirect /> },
                          ...workspaceRoutes,
                        ],
                      },
                      {
                        path: "/dashboard",
                        element: <Navigate replace to="/workspaces" />,
                      },
                    ],
                  },
                ],
              },
            ],
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
