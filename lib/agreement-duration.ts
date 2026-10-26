export type AgreementDurationUnit = "MONTH" | "YEAR";

export const DEFAULT_AGREEMENT_DURATION_UNIT: AgreementDurationUnit = "MONTH";
export const DEFAULT_AGREEMENT_DURATION_VALUE = 11;

export function isAgreementDurationUnit(value: unknown): value is AgreementDurationUnit {
  return value === "MONTH" || value === "YEAR";
}

export function isValidAgreementDuration(value: number, unit: AgreementDurationUnit) {
  return Number.isInteger(value) && value >= 1 && value <= (unit === "MONTH" ? 120 : 10);
}

export function isValidIsoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month, day));
  return (
    year >= 1000 &&
    year <= 9999 &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month &&
    date.getUTCDate() === day
  );
}

export function addAgreementDuration(
  startDate: string,
  unit: AgreementDurationUnit,
  value: number,
) {
  if (!isValidIsoDate(startDate) || !isValidAgreementDuration(value, unit)) return null;

  const [year, month, day] = startDate.split("-").map(Number);
  const totalMonths = unit === "YEAR" ? value * 12 : value;
  const endExclusive = new Date(Date.UTC(year, month - 1 + totalMonths, 1));
  const lastDay = new Date(
    Date.UTC(endExclusive.getUTCFullYear(), endExclusive.getUTCMonth() + 1, 0),
  ).getUTCDate();
  endExclusive.setUTCDate(Math.min(day, lastDay));
  endExclusive.setUTCDate(endExclusive.getUTCDate() - 1);
  return endExclusive.toISOString().slice(0, 10);
}

export function hasValidAgreementDurationTerm(
  startDate: string,
  endDate: string,
  unit: AgreementDurationUnit,
  value: number,
) {
  return addAgreementDuration(startDate, unit, value) === endDate;
}
