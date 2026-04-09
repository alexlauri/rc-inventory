"use client";

import { useEffect, useRef, useState } from "react";

type TextInputProps = {
  value: string;
  onChange: (next: string) => void;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  placeholder?: string;
  className?: string;
};

export default function TextInput({
  value,
  onChange,
  inputMode = "text",
  placeholder,
  className = "",
}: TextInputProps) {
  const [draftValue, setDraftValue] = useState(value);
  const isFocusedRef = useRef(false);

  useEffect(() => {
    if (!isFocusedRef.current) {
      setDraftValue(value);
    }
  }, [value]);

  return (
    <div
      className={`flex h-[56px] w-[200px] max-w-full items-center justify-center rounded-[56px] bg-white px-6 ${className}`}
    >
      <input
        type="text"
        inputMode={inputMode}
        value={draftValue}
        placeholder={placeholder}
        onChange={(event) => {
          const next = event.target.value;
          setDraftValue(next);
          onChange(next);
        }}
        onFocus={() => {
          isFocusedRef.current = true;
        }}
        onBlur={() => {
          isFocusedRef.current = false;
          setDraftValue(value);
        }}
        className="w-full border-0 bg-transparent p-0 text-center text-[24px] font-[700] leading-none text-[var(--color-primary,#004DEA)] outline-none appearance-none [font-family:var(--font-cabinet)]"
      />
    </div>
  );
}