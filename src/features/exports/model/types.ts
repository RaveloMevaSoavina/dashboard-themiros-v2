/** Formats d'export d'un run (US-22.1), dans l'ordre de l'ecran. */
export const exportFormats = ["pdf", "docx", "xlsx", "csv"] as const

export type ExportFormat = (typeof exportFormats)[number]
