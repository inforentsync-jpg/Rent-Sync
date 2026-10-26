export function addElevenMonthTerm(startValue: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(startValue);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const start = new Date(Date.UTC(year, month, day));
  if (
    start.getUTCFullYear() !== year ||
    start.getUTCMonth() !== month ||
    start.getUTCDate() !== day
  ) {
    return null;
  }

  const endExclusive = new Date(Date.UTC(year, month + 11, 1));
  const monthEnd = new Date(
    Date.UTC(endExclusive.getUTCFullYear(), endExclusive.getUTCMonth() + 1, 0),
  ).getUTCDate();
  endExclusive.setUTCDate(Math.min(day, monthEnd));
  endExclusive.setUTCDate(endExclusive.getUTCDate() - 1);
  return endExclusive.toISOString().slice(0, 10);
}

export function hasValidElevenMonthTerm(startDate: string, endDate: string) {
  return addElevenMonthTerm(startDate) === endDate;
}

export type AgreementStatus =
  | "Active"
  | "Expiring soon"
  | "Expired"
  | "Draft"
  | "Awaiting owner approval"
  | "Owner approved"
  | "Approved";

export function getAgreementStatus(endDate: string, today = new Date()): AgreementStatus | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(endDate);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const expiry = new Date(Date.UTC(year, month, day));
  if (
    expiry.getUTCFullYear() !== year ||
    expiry.getUTCMonth() !== month ||
    expiry.getUTCDate() !== day
  ) {
    return null;
  }

  const todayDate = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  if (expiry < todayDate) return "Expired";

  const limitYear = todayDate.getUTCFullYear();
  const limitMonth = todayDate.getUTCMonth() + 2;
  const limitDay = Math.min(
    todayDate.getUTCDate(),
    new Date(Date.UTC(limitYear, limitMonth + 1, 0)).getUTCDate(),
  );
  const expiringLimit = new Date(Date.UTC(limitYear, limitMonth, limitDay));
  return expiry <= expiringLimit ? "Expiring soon" : "Active";
}
