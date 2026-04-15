import { useState } from "react";
import { H2, Metric } from "./Type";

type FeaturedToolTileProps = {
  title: string;
  value: string;
  status: "pending" | "complete" | "saving";
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "report";
};

export default function FeaturedToolTile({
  title,
  value,
  status,
  onClick,
  disabled,
  variant = "default",
}: FeaturedToolTileProps) {
  const isReport = variant === "report";
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        onClick();
        if (isReport) {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }
      }}
      disabled={disabled}
      className={
        isReport
          ? "relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen border-0 bg-transparent p-10 pt-4 pb-4 text-left shadow-none disabled:opacity-100"
          : "relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen border-0 bg-transparent px-5 py-4 text-left shadow-none disabled:opacity-100"
      }
    >
      {isReport ? (
        <div className="text-white">
          <div className="flex items-center justify-between gap-8">
            <div className="flex min-w-0 flex-1 items-center">
              <div className="min-w-0 mt-1 [font-family:var(--font-cabinet)]">
                <div className="text-[18px] ml-3 font-[650] leading-[0.75] text-white">Send report</div>
                <div className="mt-2 ml-3 text-[16px] leading-[1.1] text-white/80">Copy and text</div>
              </div>
            </div>

            <div className="flex h-[48px] w-[132px] shrink-0 items-center justify-center rounded-full border-[2px] border-white bg-white/5 [font-family:var(--font-cabinet)] text-[16px] font-[650] uppercase tracking-[0.04em] text-white">
              <span className="translate-y-[1px]">{copied ? "COPIED!" : "COPY"}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex h-full items-end justify-between gap-6">
          <div className="flex min-w-0 flex-1 flex-col justify-between gap-5 text-white">
            <div className="space-y-1 [font-family:var(--font-cabinet)]">
              <div className="text-[18px] font-[500] leading-[1.1] text-white">{title}</div>
            </div>

            <div className="[font-family:var(--font-cabinet)]">
              <Metric className="text-white">{value}</Metric>
            </div>
          </div>

          <div className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-full bg-white">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 44 44"
              fill="none"
              className="h-10 w-10 text-primary"
              aria-hidden="true"
            >
              <path d="M27.92 21.6202C27.8724 21.4974 27.801 21.3853 27.71 21.2902L22.71 16.2902C22.6168 16.1969 22.5061 16.123 22.3842 16.0725C22.2624 16.0221 22.1319 15.9961 22 15.9961C21.7337 15.9961 21.4783 16.1019 21.29 16.2902C21.1968 16.3834 21.1228 16.4941 21.0723 16.6159C21.0219 16.7378 20.9959 16.8683 20.9959 17.0002C20.9959 17.2665 21.1017 17.5219 21.29 17.7102L24.59 21.0002H17C16.7348 21.0002 16.4804 21.1055 16.2929 21.2931C16.1054 21.4806 16 21.735 16 22.0002C16 22.2654 16.1054 22.5198 16.2929 22.7073C16.4804 22.8948 16.7348 23.0002 17 23.0002H24.59L21.29 26.2902C21.1963 26.3831 21.1219 26.4937 21.0711 26.6156C21.0203 26.7375 20.9942 26.8682 20.9942 27.0002C20.9942 27.1322 21.0203 27.2629 21.0711 27.3848C21.1219 27.5066 21.1963 27.6172 21.29 27.7102C21.383 27.8039 21.4936 27.8783 21.6154 27.9291C21.7373 27.9798 21.868 28.006 22 28.006C22.132 28.006 22.2627 27.9798 22.3846 27.9291C22.5064 27.8783 22.617 27.8039 22.71 27.7102L27.71 22.7102C27.801 22.6151 27.8724 22.5029 27.92 22.3802C28.02 22.1367 28.02 21.8636 27.92 21.6202Z" fill="currentColor" />
            </svg>
          </div>
        </div>
      )}
    </button>
  );
}