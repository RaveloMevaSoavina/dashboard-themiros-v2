import { Outlet } from "react-router-dom"

import { RunWatcher } from "@/features/evaluations/components/run-watcher"
import { WorkspaceProvider } from "@/features/workspaces/model/workspace-provider"

export function WorkspaceProviderLayout() {
  return (
    <WorkspaceProvider>
      <RunWatcher />
      <Outlet />
    </WorkspaceProvider>
  )
}
