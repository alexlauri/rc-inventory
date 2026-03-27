

import { Label, Metric, Subtle } from "@/app/components/Type";

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
      <div className="rounded-xl border bg-white p-4">
        <Label>Actual Total</Label>
        <div className="mt-1">
          <Metric className="text-3xl">${actualTotal.toFixed(2)}</Metric>
        </div>
      </div>

      <div className="space-y-3">
        {denominations.map((row) => {
          const isCoins = row.denomination === "coins";
          const quantityValue = Number(row.quantity ?? 0);
          const amountValue = Number(row.amount ?? 0);

          return (
            <div key={row.id} className="rounded-xl border bg-white p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label>{row.denomination}</Label>
                  <Subtle>
                    {isCoins
                      ? "Enter dollar value"
                      : `${Number(row.unit_value).toFixed(2)} each`}
                  </Subtle>
                </div>

                {isCoins ? (
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={amountValue}
                    onChange={(event) => {
                      const next = Number(event.target.value || 0);
                      void onUpdateDenomination(row, next);
                    }}
                    className="h-12 w-28 rounded-xl border px-3 text-right"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void onUpdateDenomination(row, quantityValue - 1)}
                      className="h-12 w-12 rounded-xl border text-xl leading-none"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      value={quantityValue}
                      onChange={(event) => {
                        const next = Number(event.target.value || 0);
                        void onUpdateDenomination(row, next);
                      }}
                      className="h-12 w-20 rounded-xl border px-2 text-center"
                    />
                    <button
                      type="button"
                      onClick={() => void onUpdateDenomination(row, quantityValue + 1)}
                      className="h-12 w-12 rounded-xl border text-xl leading-none"
                    >
                      +
                    </button>
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