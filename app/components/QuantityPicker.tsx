

 "use client";

import { Metric } from "@/app/components/Type";

type QuantityPickerProps = {
  value: number;
  onChange: (next: number) => void;
  min?: number;
};

export default function QuantityPicker({
  value,
  onChange,
  min = 0,
}: QuantityPickerProps) {
  function decrement() {
    const next = Math.max(min, value - 1);
    onChange(next);
  }

  function increment() {
    onChange(value + 1);
  }

  return (
    <div className="w-full flex items-center justify-between">
      {/* minus */}
      <button
        type="button"
        onClick={decrement}
        className="flex items-center justify-center w-12 h-12 rounded-full bg-white"
        aria-label="Decrease quantity"
      >
        <svg
          width="40"
          height="40"
          viewBox="0 0 44 44"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M29 21H15C14.7348 21 14.4804 21.1054 14.2929 21.2929C14.1054 21.4804 14 21.7348 14 22C14 22.2652 14.1054 22.5196 14.2929 22.7071C14.4804 22.8946 14.7348 23 15 23H29C29.2652 23 29.5196 22.8946 29.7071 22.7071C29.8946 22.5196 30 22.2652 30 22C30 21.7348 29.8946 21.4804 29.7071 21.2929C29.5196 21.1054 29.2652 21 29 21Z" fill="#004DEA"/>
        </svg>
      </button>

      {/* value */}
      <Metric className="text-[24px] text-[var(--color-primary,#004DEA)] tabular-nums">
        {value}
      </Metric>

      {/* plus */}
      <button
        type="button"
        onClick={increment}
        className="flex items-center justify-center w-12 h-12 rounded-full bg-white"
        aria-label="Increase quantity"
      >
        <svg
          width="40"
          height="40"
          viewBox="0 0 44 44"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M29 21H23V15C23 14.7348 22.8946 14.4804 22.7071 14.2929C22.5196 14.1054 22.2652 14 22 14C21.7348 14 21.4804 14.1054 21.2929 14.2929C21.1054 14.4804 21 14.7348 21 15V21H15C14.7348 21 14.4804 21.1054 14.2929 21.2929C14.1054 21.4804 14 21.7348 14 22C14 22.2652 14.1054 22.5196 14.2929 22.7071C14.4804 22.8946 14.7348 23 15 23H21V29C21 29.2652 21.1054 29.5196 21.2929 29.7071C21.4804 29.8946 21.7348 30 22 30C22.2652 30 22.5196 29.8946 22.7071 29.7071C22.8946 29.5196 23 29.2652 23 29V23H29C29.2652 23 29.5196 22.8946 29.7071 22.7071C29.8946 22.5196 30 22.2652 30 22C30 21.7348 29.8946 21.4804 29.7071 21.2929C29.5196 21.1054 29.2652 21 29 21Z" fill="#004DEA"/>
        </svg>
      </button>
    </div>
  );
}