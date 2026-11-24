import { Download } from "lucide-react"
import { useTranslation } from "react-i18next"

import { billingFormatters } from "@/features/billing/model/format"
import type { BillingInvoice } from "@/features/billing/model/types"
import { Badge } from "@/shared/ui/base/badge"
import { Button } from "@/shared/ui/base/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/base/table"

export function InvoicesTable({
  invoices,
  downloading,
  onDownload,
}: {
  invoices: BillingInvoice[]
  downloading: string | null
  onDownload: (invoice: BillingInvoice) => void
}) {
  const { i18n, t } = useTranslation()
  const format = billingFormatters(i18n.resolvedLanguage ?? "fr")

  return (
    <section>
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {t("billing.invoices.title")}
      </h2>
      {invoices.length === 0 ? (
        <p className="mt-3 rounded-xl border border-border p-5 text-sm text-muted-foreground">
          {t("billing.invoices.empty")}
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("billing.invoices.number")}</TableHead>
                <TableHead>{t("billing.invoices.label")}</TableHead>
                <TableHead>{t("billing.invoices.issuedOn")}</TableHead>
                <TableHead className="text-right">
                  {t("billing.invoices.amount")}
                </TableHead>
                <TableHead className="text-right">
                  {t("billing.invoices.tax")}
                </TableHead>
                <TableHead className="text-right">
                  {t("billing.invoices.total")}
                </TableHead>
                <TableHead>{t("billing.invoices.status")}</TableHead>
                <TableHead className="sr-only">
                  {t("billing.invoices.download")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium tabular-nums">
                    {invoice.number}
                  </TableCell>
                  <TableCell className="max-w-64 truncate">
                    {invoice.label}
                  </TableCell>
                  <TableCell>{format.date(invoice.issuedOn)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {format.euros(invoice.amountEur)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {format.euros(invoice.taxEur)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {format.euros(invoice.totalEur)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={invoice.overdue ? "warning" : "outline"}>
                      {invoice.overdue
                        ? t("billing.invoices.overdue")
                        : t(`billing.invoices.statuses.${invoice.status}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      aria-label={t("billing.invoices.downloadNumber", {
                        number: invoice.number,
                      })}
                      disabled={downloading !== null}
                      onClick={() => {
                        onDownload(invoice)
                      }}
                      size="icon-sm"
                      variant="ghost"
                    >
                      <Download />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  )
}
