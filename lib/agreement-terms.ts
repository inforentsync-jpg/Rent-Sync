import type { AgreementPdfData } from "@/lib/agreement-pdf.clean";

export type AgreementTerm = { number: number; text: string };

export function getAgreementTerms(data: AgreementPdfData): AgreementTerm[] {
  return (data.templateTerms ?? [])
    .flatMap((group) => [...group.items]
      .sort((a, b) => a.position - b.position)
      .map((item) => item.text?.trim().replace(/^\s*\d+[.)]\s*/, "") ?? ""))
    .filter(Boolean)
    .map((text, index) => ({ number: index + 1, text }));
}
