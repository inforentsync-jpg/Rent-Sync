import { addElevenMonthTerm } from "@/lib/rental-agreement";

export function getUpcomingAgreementTerm(now = new Date()) {
  const year = now.getUTCFullYear() + 1;
  const startDate = `${year}-01-01`;
  const endDate = addElevenMonthTerm(startDate);
  if (!endDate) throw new Error(`Unable to calculate the agreement term for ${year}.`);
  return { year, startDate, endDate };
}
