"use client";

import PageHeader from "./PageHeader";
import FeaturedToolTile from "./FeaturedToolTile";

type ChecklistToolsHeaderProps = {
  title: string;
  backHref?: string;
  onRunInventory: () => void;
  onCountCash?: () => void;
  onSendReport?: () => void;
  inventoryStatus?: "pending" | "saving" | "complete";
  cashStatus?: "pending" | "saving" | "complete";
  reportStatus?: "pending" | "saving" | "complete";
  inventoryLabel?: string;
  cashLabel?: string;
  reportLabel?: string;
  showInventory?: boolean;
  showCash?: boolean;
  showReport?: boolean;
  inventoryDisabled?: boolean;
  cashDisabled?: boolean;
  reportDisabled?: boolean;
};

export default function ChecklistToolsHeader({
  title,
  backHref,
  onRunInventory,
  onCountCash,
  onSendReport,
  inventoryStatus = "pending",
  cashStatus = "pending",
  reportStatus = "pending",
  inventoryLabel = "",
  cashLabel = "",
  reportLabel = "",
  showInventory = true,
  showCash = true,
  showReport = true,
  inventoryDisabled = false,
  cashDisabled = false,
  reportDisabled = false,
}: ChecklistToolsHeaderProps) {
  return (
    <div
      className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen px-6 space-y-0 pt-4 pb-4 -mt-4"
      style={{ backgroundColor: "var(--color-primary, #004DEA)" }}
    >
      <div className="text-white">
        <PageHeader title={title} backHref={backHref} />
      </div>

      {(showInventory || showCash || showReport) && (
        <div className="grid gap-0 grid-cols-1">
          {showInventory && (
            <FeaturedToolTile
              title="Run inventory"
              value={inventoryLabel}
              status={inventoryStatus}
              onClick={onRunInventory}
              disabled={inventoryDisabled}
            />
          )}

          {showCash && onCountCash && (
            <FeaturedToolTile
              title="Count cash"
              value={cashLabel}
              status={cashStatus}
              onClick={onCountCash}
              disabled={cashDisabled}
            />
          )}

          {showReport && onSendReport && (
            <FeaturedToolTile
              variant="report"
              title="Send Report"
              value={reportLabel}
              status={reportStatus}
              onClick={onSendReport}
              disabled={reportDisabled}
            />
          )}
        </div>
      )}
    </div>
  );
}