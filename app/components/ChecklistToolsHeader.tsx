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
      className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen space-y-0 rounded-b-[44px] px-6 pb-4"
      style={{
        backgroundColor: "var(--color-primary, #004DEA)",
        // Fill the top safe area (iOS notch/status bar region) with header blue.
        paddingTop: "calc(1rem + env(safe-area-inset-top, 0px))",
        marginTop: "calc(-1rem - env(safe-area-inset-top, 0px))",
      }}
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
            <div
              className="mt-3 mb-3 -ml-1 -mr-1 rounded-[56px]"
              style={{
                backgroundColor: "rgba(255,255,255,0.1)",
              }}
            >
              <FeaturedToolTile
                variant="report"
                title="Send Report"
                value={reportLabel}
                status={reportStatus}
                onClick={onSendReport}
                disabled={reportDisabled}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}