import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"

import type { RestitutionOrigin } from "@/features/evaluations/model/types"
import { useWorkspaces } from "@/features/workspaces/model/workspace-provider"
import { Badge } from "@/shared/ui/base/badge"

/**
 * Origine d'une puce de synthese ou d'une action : pilier, critere ou
 * alerte, cliquable vers son ecran. Le detail par critere n'est pas ouvert
 * au Decideur (US-2.3) : son badge reste une simple etiquette.
 */
export function OriginBadge({
  origin,
  workspaceId,
}: {
  origin: RestitutionOrigin
  workspaceId: string
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { persona } = useWorkspaces()
  const analysisPath = `/workspaces/${workspaceId}/analysis`
  const target =
    origin.type === "pillar"
      ? `${analysisPath}/pillars/${origin.id}`
      : origin.type === "alert"
        ? `${analysisPath}/alerts${origin.pillarId ? `?pillar=${origin.pillarId}` : ""}`
        : persona === "decideur"
          ? null
          : `${analysisPath}/criteria?criterion=${origin.id}`
  const label = `${t(`evaluation.restitution.origin.${origin.type}`)} · ${
    origin.name ?? "—"
  }`

  if (!target) return <Badge variant="secondary">{label}</Badge>
  return (
    <button onClick={() => void navigate(target)} type="button">
      <Badge className="hover:bg-muted" variant="secondary">
        {label}
      </Badge>
    </button>
  )
}
