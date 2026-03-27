type StickySubmitButtonProps = {
    label: string;
    onClick: () => void;
    disabled?: boolean;
  };
  
  export default function StickySubmitButton({
    label,
    onClick,
    disabled,
  }: StickySubmitButtonProps) {
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40">
        <div className="mx-auto flex max-w-md justify-center px-4 pb-4">
          <div className="pointer-events-auto w-full rounded-2xl bg-white/0 p-3 shadow-lg ring-1 ring-black/5 backdrop-blur">
            <button
              type="button"
              onClick={onClick}
              disabled={disabled}
              className="w-full rounded-xl bg-black px-4 py-3 text-white font-medium shadow-sm transition active:scale-[0.99] disabled:opacity-50"
            >
              {label}
            </button>
          </div>
        </div>
      </div>
    );
  }