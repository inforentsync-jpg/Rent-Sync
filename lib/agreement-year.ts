import { addElevenMonthTerm } from "@/lib/rental-agreement";
import {
  addAgreementDuration,
  DEFAULT_AGREEMENT_DURATION_UNIT,
  DEFAULT_AGREEMENT_DURATION_VALUE,
  type AgreementDurationUnit,
} from "@/lib/agreement-duration";

function parseIsoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (
    date.getUTCFullYear() !== Number(match[1]) ||
    date.getUTCMonth() !== Number(match[2]) - 1 ||
    date.getUTCDate() !== Number(match[3])
  ) {
    return null;
  }
  return date;
}

function toIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function getRenewalAgreementTerm(
  previousStartDate: string,
  previousEndDate: string,
  now = new Date(),
  durationUnit: AgreementDurationUnit = DEFAULT_AGREEMENT_DURATION_UNIT,
  durationValue = DEFAULT_AGREEMENT_DURATION_VALUE,
) {
  const start = parseIsoDate(previousStartDate);
  const end = parseIsoDate(previousEndDate);
  if (!start || !end) return null;

  const renewalWindow = new Date(end);
  const originalDay = renewalWindow.getUTCDate();
  renewalWindow.setUTCDate(1);
  renewalWindow.setUTCMonth(renewalWindow.getUTCMonth() - 2);
  const lastDayOfWindowMonth = new Date(
    Date.UTC(renewalWindow.getUTCFullYear(), renewalWindow.getUTCMonth() + 1, 0),
  ).getUTCDate();
  renewalWindow.setUTCDate(Math.min(originalDay, lastDayOfWindowMonth));

  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (today < renewalWindow) return null;

  const nextStartYear = start.getUTCFullYear() + 1;
  const lastDayOfNextStartMonth = new Date(
    Date.UTC(nextStartYear, start.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const nextStart = new Date(
    Date.UTC(nextStartYear, start.getUTCMonth(), Math.min(start.getUTCDate(), lastDayOfNextStartMonth)),
  );
  const nextStartDate = toIsoDate(nextStart);
  const nextEndDate =
    durationUnit === "MONTH" && durationValue === DEFAULT_AGREEMENT_DURATION_VALUE
      ? addElevenMonthTerm(nextStartDate)
      : addAgreementDuration(nextStartDate, durationUnit, durationValue);
  if (!nextEndDate) {
    throw new Error(`Unable to calculate the agreement renewal term from ${previousStartDate}.`);
  }
  return {
    year: nextStartYear,
    startDate: nextStartDate,
    endDate: nextEndDate,
  };
}
