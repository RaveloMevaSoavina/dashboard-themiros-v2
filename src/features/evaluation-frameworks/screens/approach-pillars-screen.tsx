import { useNavigate, useParams } from "react-router-dom"

import { FrameworkPillarsScreen } from "@/features/evaluations/screens/framework-pillars-screen"

export function ApproachPillarsScreen() {
  const navigate = useNavigate()
  const { workspaceId = "" } = useParams<{ workspaceId: string }>()

  return (
    <FrameworkPillarsScreen
      onValidated={() => void navigate(`/workspaces/${workspaceId}/analysis`)}
    />
  )
}
