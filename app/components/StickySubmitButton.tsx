import type { ReactNode } from "react";

type StickySubmitButtonProps = {
    label?: string;
    onClick: () => void;
    disabled?: boolean;
    children?: ReactNode;
    className?: string;
  };
  
  export default function StickySubmitButton({
    label,
    onClick,
    disabled,
    children,
    className = "",
  }: StickySubmitButtonProps) {
    return (
      <div className="pointer-events-none fixed bottom-0 left-0 right-0 z-40 flex justify-center px-12 pb-8">
        <div
          className="pointer-events-auto w-full overflow-hidden rounded-full [font-family:var(--font-cabinet)]"
          style={{
            backgroundColor: disabled
              ? "rgba(0, 77, 234, 0.25)"
              : "rgba(0, 77, 234, 0.95)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
          }}
        >
          <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={`w-full h-[56px] bg-transparent text-white uppercase font-[650] tracking-[0.04em] transition active:scale-[0.99] disabled:opacity-75 translate-y-[1px] ${className}`}
          >
            {children ?? label}
          </button>
        </div>
      </div>
    );
  }