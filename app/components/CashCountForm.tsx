import { Label, Metric, Subtle } from "@/app/components/Type";
import QuantityPicker from "@/app/components/QuantityPicker";
import TextInput from "@/app/components/TextInput";

type DenominationRow = {
  id: string;
  denomination: string;
  unit_value: number;
  quantity: number | null;
  amount: number;
};

type CashCountFormProps = {
  actualTotal: number;
  denominations: DenominationRow[];
  onUpdateDenomination: (row: DenominationRow, nextValue: number | null) => void | Promise<void>;
};

export default function CashCountForm({
  actualTotal,
  denominations,
  onUpdateDenomination,
}: CashCountFormProps) {
  return (
    <>
      <div className="pb-4 flex justify-center">
        <Metric className="text-center text-[var(--color-primary,#004DEA)]">
          ${actualTotal.toFixed(2)}
        </Metric>
      </div>

      <div className="space-y-0">
        {denominations.map((row) => {
          const isCoins = row.denomination === "coins";
          const quantityValue = Number(row.quantity ?? 0);
          const amountValue = Number(row.amount ?? 0);
          const denominationLabel = isCoins
            ? "Coins"
            : `$${Number(row.unit_value).toFixed(0)}`;

          return (
            <div
              key={row.id}
              className="border-t-[2px] border-[var(--color-primary,#004DEA)] py-4"
            >
              <div className="relative min-h-[48px]">
                <div className="absolute left-0 top-1/2 -translate-y-1/2 text-[17px] font-[700] leading-none text-[var(--color-primary,#004DEA)] [font-family:var(--font-cabinet)]">
                  {denominationLabel}
                </div>

                {isCoins ? (
                  <div className="flex justify-center">
                    <TextInput
                      value={String(amountValue)}
                      inputMode="decimal"
                      onChange={(value) => {
                        const next = parseFloat(value || "0");
                        void onUpdateDenomination(row, next);
                      }}
                    />
                  </div>
                ) : (
                  <div className="flex justify-center">
                    <div className="w-[200px] max-w-full">
                      <QuantityPicker
                        value={quantityValue}
                        onChange={(next) => {
                          void onUpdateDenomination(row, next);
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}