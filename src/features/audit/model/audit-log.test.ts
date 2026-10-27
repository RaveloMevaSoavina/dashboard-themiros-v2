import assert from "node:assert/strict"
import test from "node:test"
import {
  auditChanges,
  formatAuditValue,
  periodBounds,
  toCsv,
} from "./audit-log.ts"

test("les champs modifies passent devant et l'ancienne valeur reste lisible", () => {
  const changes = auditChanges(
    { status: "a_instruire", severity: "majeure", note: 3 },
    { status: "instruite", severity: "majeure" }
  )
  assert.deepEqual(
    changes.map((change) => [change.field, change.changed]),
    [
      ["status", true],
      ["note", true],
      ["severity", false],
    ]
  )
  assert.equal(changes[1]?.before, 3)
  assert.equal(changes[1]?.after, null)
})

test("une creation n'a que des valeurs apres", () => {
  assert.deepEqual(auditChanges(null, { validated_at: "2026-10-27" }), [
    {
      field: "validated_at",
      before: null,
      after: "2026-10-27",
      changed: true,
    },
  ])
})

test("les valeurs composees s'affichent en JSON", () => {
  assert.equal(formatAuditValue(null), "—")
  assert.equal(formatAuditValue(false), "false")
  assert.equal(formatAuditValue({ a: 1 }), '{\n  "a": 1\n}')
})

test("la periode inclut le dernier jour entier", () => {
  const bounds = periodBounds({ from: "2026-10-01", to: "2026-10-03" })
  assert.equal(bounds.from, new Date("2026-10-01T00:00:00").toISOString())
  assert.equal(bounds.to, new Date("2026-10-04T00:00:00").toISOString())
  assert.deepEqual(periodBounds({ from: null, to: null }), {
    from: null,
    to: null,
  })
})

test("le CSV echappe les separateurs et neutralise les formules", () => {
  assert.equal(
    toCsv([
      ["a;b", 'dit "oui"', "=SOMME(A1)"],
      ["ligne\nsuivante", "-3", "ok"],
    ]),
    '﻿"a;b";"dit ""oui""";\'=SOMME(A1)\r\n"ligne\nsuivante";\'-3;ok\r\n'
  )
})
