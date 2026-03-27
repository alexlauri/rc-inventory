import { Subtle } from "./Type";

type StatusPillProps = {
    status: "pending" | "complete" | "saving";
  };
  
  export default function StatusPill({ status }: StatusPillProps) {
    const label =
      status === "saving" ? "Saving..." : status === "complete" ? "Complete" : "Pending";
  
    const classes =
      status === "complete"
        ? "border-green-200 bg-green-50 text-green-700"
        : "border-gray-200 bg-gray-50 text-gray-600";
  
    return (
      <div className={`inline-flex rounded-full border px-2.5 py-1 ${classes}`}>
        <Subtle className="text-xs font-medium leading-none [font-family:var(--font-cabinet)]">{label}</Subtle>
      </div>
    );
  }