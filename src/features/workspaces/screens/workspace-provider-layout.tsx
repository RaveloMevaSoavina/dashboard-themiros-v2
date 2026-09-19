import { Outlet } from "react-router-dom"

import { WorkspaceProvider } from "@/features/workspaces/model/workspace-provider"

export function WorkspaceProviderLayout() {
  return (
    <WorkspaceProvider>
      <Outlet />
    </WorkspaceProvider>
  )
}
