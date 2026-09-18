import {
  BarChart3,
  ClipboardList,
  Download,
  FolderOpen,
  History,
  Settings,
} from "lucide-react"
import type { ComponentType, SVGProps } from "react"

import type { Persona } from "@/features/workspaces/model/types"

/** Feuille de navigation : une entree qui mene a un ecran. */
export type NavChild = {
  /** Suffixe de route sous /workspaces/:workspaceId */
  segment: string
  /** Cle i18n sous `nav.items.` */
  labelKey: string
  /** Personas autorises a voir l'entree (US-2.3, US-2.4). */
  personas: readonly Persona[]
}

export type NavItem = NavChild & {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  /**
   * Sous-entrees. Le parent reste navigable : son `segment` est la vue
   * par defaut du groupe, et les enfants sont des routes filles.
   */
  children?: readonly NavChild[]
}

export type NavSection = {
  /** Cle i18n sous `nav.sections.` */
  titleKey: string
  items: readonly NavItem[]
}

const allPersonas = ["decideur", "pmu", "analyste"] as const
/* Le Decideur ne voit qu'Analyse, Plan d'action et Exports (US-2.3). */
const withoutDecideur = ["pmu", "analyste"] as const
/* Le detail de verification est reserve a l'Analyste M&E (US-2.4). */
const analysteOnly = ["analyste"] as const

/**
 * Arborescence des ecrans Themiros, reprise de « Ecrans et user stories ».
 * Les sous-entrees correspondent aux ecrans numerotes du document.
 */
export const navSections: readonly NavSection[] = [
  {
    titleKey: "corpus",
    items: [
      {
        segment: "corpus",
        labelKey: "corpus",
        icon: FolderOpen,
        personas: withoutDecideur,
        children: [
          /* Ecran 8 */
          {
            segment: "import",
            labelKey: "import",
            personas: withoutDecideur,
          },
          /* Ecran 9 */
          {
            segment: "documents",
            labelKey: "documents",
            personas: withoutDecideur,
          },
          /* Ecran 11 */
          {
            segment: "inventory",
            labelKey: "inventory",
            personas: withoutDecideur,
          },
        ],
      },
    ],
  },
  {
    titleKey: "evaluation",
    items: [
      {
        segment: "framework",
        labelKey: "framework",
        icon: ClipboardList,
        personas: withoutDecideur,
        children: [
          /* Ecran 6 */
          {
            segment: "pillars",
            labelKey: "pillars",
            personas: withoutDecideur,
          },
          /* Ecran 7 */
          {
            segment: "criteria",
            labelKey: "criteria",
            personas: withoutDecideur,
          },
        ],
      },
      {
        segment: "analysis",
        labelKey: "analysis",
        icon: BarChart3,
        personas: allPersonas,
        children: [
          /* Ecran 14 */
          {
            segment: "overview",
            labelKey: "overview",
            personas: allPersonas,
          },
          /* Ecran 15 — couche A */
          {
            segment: "pillars",
            labelKey: "layerA",
            personas: allPersonas,
          },
          /* Ecran 16 — couche B */
          {
            segment: "criteria",
            labelKey: "layerB",
            personas: withoutDecideur,
          },
          /* Ecran 17 — couche C */
          {
            segment: "alerts",
            labelKey: "layerC",
            personas: allPersonas,
          },
        ],
      },
      {
        segment: "plan",
        labelKey: "plan",
        icon: ClipboardList,
        personas: allPersonas,
        children: [
          /* Ecran 18 */
          {
            segment: "synthesis",
            labelKey: "synthesis",
            personas: allPersonas,
          },
          /* Ecran 19 */
          {
            segment: "actions",
            labelKey: "actions",
            personas: allPersonas,
          },
        ],
      },
    ],
  },
  {
    titleKey: "governance",
    items: [
      /* Ecran 21 */
      {
        segment: "audit",
        labelKey: "audit",
        icon: History,
        personas: analysteOnly,
      },
      /* Ecran 22 */
      {
        segment: "exports",
        labelKey: "exports",
        icon: Download,
        personas: allPersonas,
      },
      /* Ecran 23 */
      {
        segment: "settings",
        labelKey: "settings",
        icon: Settings,
        personas: withoutDecideur,
        children: [
          {
            segment: "general",
            labelKey: "general",
            personas: withoutDecideur,
          },
          {
            segment: "fingerprint",
            labelKey: "fingerprint",
            personas: withoutDecideur,
          },
          {
            segment: "versions",
            labelKey: "versions",
            personas: withoutDecideur,
          },
        ],
      },
    ],
  },
]

/**
 * Retire les entrees interdites au persona, puis les sections devenues
 * vides. Un parent dont tous les enfants sont filtres reste affiche s'il
 * est lui-meme autorise : sa vue par defaut demeure accessible.
 */
export function sectionsForPersona(persona: Persona): NavSection[] {
  return navSections
    .map((section) => ({
      ...section,
      items: section.items
        .filter((item) => item.personas.includes(persona))
        .map((item) => ({
          ...item,
          children: item.children?.filter((child) =>
            child.personas.includes(persona)
          ),
        })),
    }))
    .filter((section) => section.items.length > 0)
}
