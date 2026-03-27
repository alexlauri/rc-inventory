type ActionButtonProps = {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    complete?: boolean;
  };
  
  export default function ActionButton({
    label,
    onClick,
    disabled,
    complete = false,
  }: ActionButtonProps) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`w-full rounded-xl border px-4 py-3 font-medium disabled:opacity-50 ${
          complete ? "border-green-200 bg-green-50 text-green-700" : ""
        }`}
      >
        {label}
      </button>
    );
  }