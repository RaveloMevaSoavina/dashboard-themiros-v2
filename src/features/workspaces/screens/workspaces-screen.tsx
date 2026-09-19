import { FolderPlus, Plus, RotateCcw } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"

import { WorkspaceCard } from "@/features/workspaces/components/workspace-card"
import { useWorkspaces } from "@/features/workspaces/model/workspace-provider"
import { Button } from "@/shared/ui/base/button"
import { Skeleton } from "@/shared/ui/base/skeleton"

/**
 * Ecran 1 « Espaces de travail » (v-espaces). Quatre etats a couvrir :
 * chargement, erreur, vide et nominal (US-1.1 a US-1.4).
 */
export function WorkspacesScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { workspaces, isLoading, error, refetch, selectWorkspace } =
    useWorkspaces()

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {t("workspaces.eyebrow")}
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">
            {t("workspaces.title")}
          </h1>
        </div>

        {/* US-1.2 : sur l'etat vide, le bouton de creation est le seul
            element interactif — on le retire donc de l'en-tete. */}
        {!isLoading && !error && workspaces.length > 0 ? (
          <Button
            onClick={() => {
              void navigate("/workspaces/new")
            }}
            size="lg"
          >
            <Plus />
            {t("workspaces.create")}
          </Button>
        ) : null}
      </div>

      {isLoading ? (
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {["a", "b", "c", "d"].map((key) => (
            <Skeleton className="h-[126px] rounded-xl" key={key} />
          ))}
        </div>
      ) : null}

      {!isLoading && error ? (
        <div className="mt-8 flex flex-col items-start gap-4 rounded-xl border border-border p-6">
          <p className="text-[13px] text-muted-foreground">
            {t("workspaces.error.description")}
          </p>
          <Button onClick={refetch} size="lg" variant="outline">
            <RotateCcw />
            {t("workspaces.error.retry")}
          </Button>
        </div>
      ) : null}

      {!isLoading && !error && workspaces.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-5 rounded-xl border border-border px-6 py-20 text-center">
          <FolderPlus className="size-7 text-muted-foreground" />
          <div>
            <p className="text-[14px] font-semibold">
              {t("workspaces.empty.title")}
            </p>
            <p className="mt-1.5 text-[13px] text-muted-foreground">
              {t("workspaces.empty.description")}
            </p>
          </div>
          <Button
            onClick={() => {
              void navigate("/workspaces/new")
            }}
            size="lg"
          >
            <Plus />
            {t("workspaces.empty.action")}
          </Button>
        </div>
      ) : null}

      {!isLoading && !error && workspaces.length > 0 ? (
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {workspaces.map((workspace) => (
            <WorkspaceCard
              key={workspace.id}
              onOpen={selectWorkspace}
              workspace={workspace}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
