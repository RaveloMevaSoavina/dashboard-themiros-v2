import { useQuery } from "@tanstack/react-query"

import {
  type CriticalMassSettingsValues,
  defaultCriticalMassSettings,
} from "@/features/corpus/model/critical-mass"
import { getCriticalMassSettings } from "@/features/corpus/services/critical-mass-settings-service"

export function criticalMassSettingsQueryKey(workspaceId: string) {
  return ["critical-mass-settings", workspaceId] as const
}

/**
 * Paramètres de masse critique appliqués à l'espace. Les valeurs de la note
 * de décision servent tant que la base n'a pas répondu.
 */
export function useCriticalMassSettings(workspaceId: string) {
  const query = useQuery({
    queryKey: criticalMassSettingsQueryKey(workspaceId),
    queryFn: () => getCriticalMassSettings(workspaceId),
    enabled: Boolean(workspaceId),
    staleTime: 60_000,
  })
  const settings: CriticalMassSettingsValues =
    query.data?.current ?? defaultCriticalMassSettings
  return { query, settings }
}
