/* Exception a la charte, limitee aux jauges de score : le niveau se lit a
   la couleur (faible < 40 %, moyen < 70 %, eleve). Les classes sont ecrites
   en entier pour que Tailwind les detecte. */
export type ScoreLevel = "low" | "mid" | "high"

export function scoreLevel(percentage: number): ScoreLevel {
  if (percentage < 40) return "low"
  if (percentage < 70) return "mid"
  return "high"
}

export const scoreTextClass: Record<ScoreLevel, string> = {
  low: "text-score-low",
  mid: "text-score-mid",
  high: "text-score-high",
}

export const scoreFillClass: Record<ScoreLevel, string> = {
  low: "bg-score-low",
  mid: "bg-score-mid",
  high: "bg-score-high",
}

/** Note de critere (0-3) ramenee en pourcentage pour choisir le niveau. */
export function notePercentage(note: number) {
  return (note / 3) * 100
}
