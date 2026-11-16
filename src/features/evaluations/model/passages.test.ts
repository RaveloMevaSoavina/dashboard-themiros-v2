import assert from "node:assert/strict"
import test from "node:test"
import {
  citedPassage,
  cleanText,
  paragraphs,
  withoutMarkers,
} from "./passages.ts"

const EXCERPT =
  "Le taux de décaissement atteint 60 %\npar an. Les responsables sont rempla-\ncés souvent. Le contexte est instable."

test("un extrait de PDF se lit sans cesure ni retour a la ligne", () => {
  assert.equal(
    cleanText(EXCERPT),
    "Le taux de décaissement atteint 60 % par an. Les responsables sont remplacés souvent. Le contexte est instable."
  )
})

test("le passage cite reprend les phrases designees par leurs positions", () => {
  const second = EXCERPT.indexOf("Les responsables")
  const third = EXCERPT.indexOf("Le contexte")
  assert.equal(
    citedPassage(EXCERPT, [[second, third - 1]]),
    "Les responsables sont remplacés souvent."
  )
  // Deux passages disjoints, separes par « … » ; positions hors extrait ignorees.
  assert.equal(
    citedPassage(EXCERPT, [
      [third, EXCERPT.length],
      [0, 10],
      [500, 600],
    ]),
    "Le taux de … Le contexte est instable."
  )
  assert.equal(citedPassage(EXCERPT, null), null)
})

test("les positions comptent les caracteres Unicode, comme l'API", () => {
  const text = "𝑥 vaut 2. Fin du passage."
  // En Python, « 𝑥 vaut 2. » occupe les positions 0 a 9.
  assert.equal(citedPassage(text, [[10, 25]]), "Fin du passage.")
})

test("un paragraphe de l'IA se lit sans ses marqueurs de sources", () => {
  assert.equal(
    withoutMarkers("Le taux progresse ⟦1⟧, mais reste bas ⟦1,2⟧."),
    "Le taux progresse, mais reste bas."
  )
})

test("une interpretation garde ses paragraphes", () => {
  assert.deepEqual(paragraphs("Premier ⟦1⟧.\n\n  \nSecond ⟦2⟧.\nSuite."), [
    "Premier ⟦1⟧.",
    "Second ⟦2⟧.\nSuite.",
  ])
  assert.deepEqual(paragraphs("  "), [])
})
