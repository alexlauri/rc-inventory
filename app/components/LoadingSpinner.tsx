type LoadingSpinnerProps = {
  /** Extra classes on the outer wrapper (layout, padding). */
  className?: string;
  /** Pixel size of the spinner (width & height). Default 32. */
  size?: number;
};

export default function LoadingSpinner({
  className = "",
  size = 32,
}: LoadingSpinnerProps) {
  return (
    <div
      className={`flex justify-center py-8 ${className}`}
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">Loading</span>
      <div
        className="shrink-0 animate-spin rounded-full border-2 border-[color:var(--color-primary,#004DEA)] border-t-transparent"
        style={{ width: size, height: size }}
        aria-hidden
      />
    </div>
  );
}
