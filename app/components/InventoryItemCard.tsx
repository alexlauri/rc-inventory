import QuantityPicker from "@/app/components/QuantityPicker";
import { H2, Label, Subtle } from "@/app/components/Type";

type InventoryItem = {
  id: string;
  item_name: string;
  item_category: string | null;
  item_unit: string | null;
  item_par?: number | null;
  item_threshold?: number | null;
  trailer_qty: number;
  storage_qty: number;
  total?: number;
  suggestedOrderQty?: number;
  status?: "critical" | "low";
  supplier_name?: string | null;
  supplier?: string | null;
};

type InventoryItemCardProps = {
  item: InventoryItem;
  onTrailerChange?: (next: number) => void;
  onStorageChange?: (next: number) => void;
  onSave?: () => void;
  saveLabel?: string;
  saveDisabled?: boolean;
};

function buildMetaLabel(item: InventoryItem) {
  const unit = item.item_unit?.toUpperCase() || "UNIT";
  const par = item.item_par ?? 0;
  return `${unit} • PAR ${par}`;
}

function getQuantityStep(item: InventoryItem) {
  const threshold = item.item_threshold ?? 0;
  return Number.isInteger(threshold) ? 1 : 0.25;
}

export default function InventoryItemCard({
  item,
  onTrailerChange,
  onStorageChange,
  onSave,
  saveLabel = "Save",
  saveDisabled = false,
}: InventoryItemCardProps) {
  const step = getQuantityStep(item);

  return (
    <div className="space-y-3 rounded-[28px] bg-transparent">
      <div className="space-y-1">
        <H2>{item.item_name}</H2>
        <Subtle className="text-[var(--color-foreground,#3A3A3A)] uppercase tracking-[0.06em]">
          {buildMetaLabel(item)}
        </Subtle>
      </div>

      <div className="grid grid-cols-1 gap-1">
        <div className="space-y-0 rounded-[20px] bg-[rgba(0,0,0,0.04)] px-6 pt-3 pb-4">
          <div className="flex justify-center">
            <Label className="text-[var(--color-foreground,#3A3A3A)]">Trailer</Label>
          </div>

          <QuantityPicker
            value={item.trailer_qty}
            step={step}
            onChange={(next) => {
              onTrailerChange?.(next);
            }}
          />
        </div>

        <div className="space-y-0 rounded-[20px] bg-[rgba(0,0,0,0.04)] px-6 pt-3 pb-4">
          <div className="flex justify-center">
            <Label className="text-[var(--color-foreground,#3A3A3A)]">Storage</Label>
          </div>

          <QuantityPicker
            value={item.storage_qty}
            step={step}
            onChange={(next) => {
              onStorageChange?.(next);
            }}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => onSave?.()}
        disabled={saveDisabled}
        className="flex h-[56px] w-full items-center justify-center rounded-full bg-[rgba(37,84,225,0.12)] text-[var(--color-primary,#004DEA)] uppercase tracking-[0.04em] transition active:scale-[0.99] disabled:opacity-50"
      >
        <Label className="text-[var(--color-primary,#004DEA)] uppercase tracking-[0.04em]">
          {saveLabel}
        </Label>
      </button>
    </div>
  );
}
