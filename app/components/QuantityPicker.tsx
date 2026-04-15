"use client";

import { useEffect, useRef, useState } from "react";

type QuantityPickerProps = {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  step?: number;
};

export default function QuantityPicker({
  value,
  onChange,
  min = 0,
  step = 1,
}: QuantityPickerProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => String(value));
  const inputRef = useRef<HTMLInputElement>(null);
  /** Skip blur-commit when closing via Escape (unmount can still fire blur). */
  const skipBlurCommitRef = useRef(false);

  useEffect(() => {
    if (!editing) {
      setDraft(formatValue(value));
    }
  }, [value, editing]);

  useEffect(() => {
    if (!editing) return;
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, [editing]);

  function normalize(next: number) {
    const rounded = Math.round(next / step) * step;
    const safe = Math.round(rounded * 100) / 100;
    return Math.max(min, safe);
  }

  function formatValue(next: number) {
    return Number.isInteger(next)
      ? String(next)
      : String(next.toFixed(2)).replace(/\.?0+$/, "");
  }

  function commitDraft() {
    const normalizedDraft =
      step < 1 ? draft.replace(/[^\d.]/g, "") : draft.replace(/\D/g, "");
    if (normalizedDraft === "" || normalizedDraft === ".") {
      onChange(min);
      setEditing(false);
      return;
    }
    const n =
      step < 1
        ? Number.parseFloat(normalizedDraft)
        : Number.parseInt(normalizedDraft, 10);
    if (Number.isNaN(n)) {
      setDraft(formatValue(value));
    } else {
      onChange(normalize(n));
    }
    setEditing(false);
  }

  function decrement() {
    onChange(normalize(value - step));
  }

  function increment() {
    onChange(normalize(value + step));
  }

  const valueClasses =
    "text-[24px] font-semibold leading-none text-[var(--color-primary,#004DEA)] tabular-nums [font-family:var(--font-cabinet)]";

  return (
    <div className="flex w-full items-center justify-between">
      <button
        type="button"
        onClick={decrement}
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white"
        aria-label="Decrease quantity"
      >
        <svg
          width="40"
          height="40"
          viewBox="0 0 44 44"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden
        >
          <path
            d="M29 21H15C14.7348 21 14.4804 21.1054 14.2929 21.2929C14.1054 21.4804 14 21.7348 14 22C14 22.2652 14.1054 22.5196 14.2929 22.7071C14.4804 22.8946 14.7348 23 15 23H29C29.2652 23 29.5196 22.8946 29.7071 22.7071C29.8946 22.5196 30 22.2652 30 22C30 21.7348 29.8946 21.4804 29.7071 21.2929C29.5196 21.1054 29.2652 21 29 21Z"
            fill="#004DEA"
          />
        </svg>
      </button>

      {editing ? (
        <input
          ref={inputRef}
          type="text"
          inputMode={step < 1 ? "decimal" : "numeric"}
          autoComplete="off"
          aria-label="Quantity"
          value={draft}
          onChange={(e) => {
            const next = e.target.value;
            if (step < 1) {
              const cleaned = next
                .replace(/[^\d.]/g, "")
                .replace(/(\..*)\./g, "$1");
              setDraft(cleaned);
              return;
            }
            setDraft(next.replace(/\D/g, ""));
          }}
          onBlur={() => {
            if (skipBlurCommitRef.current) {
              skipBlurCommitRef.current = false;
              return;
            }
            commitDraft();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              skipBlurCommitRef.current = true;
              commitDraft();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              skipBlurCommitRef.current = true;
              setDraft(formatValue(value));
              setEditing(false);
            }
          }}
          className={`${valueClasses} max-w-[min(40vw,4rem)] min-w-[2.5ch] h-12 shrink rounded-xl border-0 border-[var(--color-primary,#004DEA)] bg-white px-2 py-1 text-center outline-none`}
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            skipBlurCommitRef.current = false;
            setDraft(formatValue(value));
            setEditing(true);
          }}
          className="min-w-[3ch] shrink rounded-xl px-3 py-2 transition active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary,#004DEA)]"
          aria-label="Type quantity"
        >
          <span className={valueClasses}>{formatValue(value)}</span>
        </button>
      )}

      <button
        type="button"
        onClick={increment}
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white"
        aria-label="Increase quantity"
      >
        <svg
          width="40"
          height="40"
          viewBox="0 0 44 44"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden
        >
          <path
            d="M29 21H23V15C23 14.7348 22.8946 14.4804 22.7071 14.2929C22.5196 14.1054 22.2652 14 22 14C21.7348 14 21.4804 14.1054 21.2929 14.2929C21.1054 14.4804 21 14.7348 21 15V21H15C14.7348 21 14.4804 21.1054 14.2929 21.2929C14.1054 21.4804 14 21.7348 14 22C14 22.2652 14.1054 22.5196 14.2929 22.7071C14.4804 22.8946 14.7348 23 15 23H21V29C21 29.2652 21.1054 29.5196 21.2929 29.7071C21.4804 29.8946 21.7348 30 22 30C22.2652 30 22.5196 29.8946 22.7071 29.7071C22.8946 29.5196 23 29.2652 23 29V23H29C29.2652 23 29.5196 22.8946 29.7071 22.7071C29.8946 22.5196 30 22.2652 30 22C30 21.7348 29.8946 21.4804 29.7071 21.2929C29.5196 21.1054 29.2652 21 29 21Z"
            fill="#004DEA"
          />
        </svg>
      </button>
    </div>
  );
}
