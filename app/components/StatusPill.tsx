import { Subtle } from "./Type";

type StatusPillProps = {
  status: "pending" | "complete" | "saving" | "critical" | "low";
};

export default function StatusPill({ status }: StatusPillProps) {
  const label =
    status === "saving"
      ? "Saving..."
      : status === "complete"
        ? "Complete"
        : status === "critical"
          ? "Critical"
          : status === "low"
            ? "Low"
            : "Pending";

  const containerClasses =
    status === "complete"
      ? "border-green-200 bg-green-50"
      : status === "critical"
        ? "border-red-200 bg-red-50"
        : status === "low"
          ? "border-yellow-200 bg-yellow-50"
          : "border-gray-200 bg-gray-50";

  const labelClasses =
    status === "complete"
      ? "text-green-700"
      : status === "critical"
        ? "text-red-700"
        : status === "low"
          ? "text-yellow-700"
          : "text-gray-600";

  return (
    <div className={`inline-flex rounded-full border px-2.5 py-1 ${containerClasses}`}>
      <Subtle
        className={`text-xs font-medium leading-none [font-family:var(--font-cabinet)] ${labelClasses}`}
      >
        {label}
      </Subtle>
    </div>
  );
}
