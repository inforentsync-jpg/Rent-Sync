type AgreementFactsProps = {
  startDate: string;
  endDate: string;
  monthlyRent: number;
  advanceAmount?: number;
  compact?: boolean;
};

function formatDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default function AgreementFacts({
  startDate,
  endDate,
  monthlyRent,
  advanceAmount,
  compact = false,
}: AgreementFactsProps) {
  const facts = [
    { label: "Agreement start date", value: formatDate(startDate), endDate: false },
    { label: "Agreement end date", value: formatDate(endDate), endDate: true },
    { label: "Monthly rent", value: `₹${monthlyRent.toLocaleString("en-IN")}`, endDate: false },
    {
      label: "Advance / security deposit",
      value: advanceAmount === undefined ? "Not recorded" : `₹${advanceAmount.toLocaleString("en-IN")}`,
      endDate: false,
    },
  ];

  return (
    <div className={`grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4 ${compact ? "w-full" : ""}`}>
      {facts.map((fact) => (
        <div
          key={fact.label}
          className={compact
            ? "min-w-0"
            : `min-w-0 rounded-xl border bg-gradient-to-br ${fact.endDate ? "border-[#f2d6d2] from-[#fff3f1] to-[#fff9f8]" : "border-[#dcebe0] from-[#f1f8f3] to-[#f8fbf8]"} px-4 py-3.5`}
        >
          <p className={`text-[8px] font-semibold uppercase leading-4 tracking-[0.08em] ${fact.endDate ? "text-[#b34b42]" : "text-[#6b8a76]"}`}>
            {fact.label}
          </p>
          <p className={`mt-1 break-words font-semibold ${fact.endDate ? "text-[#a8322a]" : "text-[#234b34]"} ${compact ? "text-[10px]" : "text-[13px]"}`}>
            {fact.value}
          </p>
        </div>
      ))}
    </div>
  );
}
