import { Outlet } from "react-router-dom"

import { DashboardSidebar } from "@/features/dashboard/components/dashboard-sidebar"
import { DashboardTopbar } from "@/features/dashboard/components/dashboard-topbar"
import { WorkspaceProvider } from "@/features/workspaces/model/workspace-provider"
import { SidebarInset, SidebarProvider } from "@/shared/ui/base/sidebar"

/**
 * Coquille commune a tous les ecrans authentifies : barre laterale shadcn
 * (navigation projetee par persona), en-tete (espace courant + puce
 * profil) et zone de contenu.
 */
export function DashboardLayout() {
  return (
    <WorkspaceProvider>
      <SidebarProvider>
        <DashboardSidebar />
        <SidebarInset>
          <DashboardTopbar />
          <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
            <Outlet />
          </main>
        </SidebarInset>
      </SidebarProvider>
    </WorkspaceProvider>
  )
}
