export type AgreementDurationUnit = "MONTH" | "YEAR";

export const DEFAULT_AGREEMENT_DURATION_UNIT: AgreementDurationUnit = "MONTH";
export const DEFAULT_AGREEMENT_DURATION_VALUE = 11;

export function addAgreementDuration(
  startDate: string,
  unit: AgreementDurationUnit,
  value: number,
) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(startDate);
  if (!match || !Number.isInteger(value) || value < 1 ||
    value > (unit === "MONTH" ? 120 : 10)) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month, day));
  if (
    year < 1000 ||
    year > 9999 ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  const totalMonths = unit === "YEAR" ? value * 12 : value;
  const endExclusive = new Date(Date.UTC(year, month + totalMonths, 1));
  const lastDay = new Date(
    Date.UTC(endExclusive.getUTCFullYear(), endExclusive.getUTCMonth() + 1, 0),
  ).getUTCDate();
  endExclusive.setUTCDate(Math.min(day, lastDay));
  endExclusive.setUTCDate(endExclusive.getUTCDate() - 1);
  return endExclusive.toISOString().slice(0, 10);
}
