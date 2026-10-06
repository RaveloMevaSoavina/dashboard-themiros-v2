import { useQuery } from "@tanstack/react-query"

import {
  defaultIngestionSettings,
  type IngestionSettingsValues,
} from "@/features/corpus/model/ingestion-settings"
import { getIngestionSettings } from "@/features/corpus/services/ingestion-settings-service"

export function ingestionSettingsQueryKey(workspaceId: string) {
  return ["ingestion-settings", workspaceId] as const
}

/**
 * Paramètres du contrôle appliqués à l'espace. Les valeurs de la
 * spécification servent tant que la base n'a pas répondu.
 */
export function useIngestionSettings(workspaceId: string) {
  const query = useQuery({
    queryKey: ingestionSettingsQueryKey(workspaceId),
    queryFn: () => getIngestionSettings(workspaceId),
    enabled: Boolean(workspaceId),
    staleTime: 60_000,
  })
  const settings: IngestionSettingsValues =
    query.data?.current ?? defaultIngestionSettings
  return { query, settings }
}
