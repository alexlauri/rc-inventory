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
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <div className="flex h-8 w-6 shrink-0 items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-6 w-6"
                  aria-hidden="true"
                >
                  <path d="M9 10H10C10.2652 10 10.5196 9.89464 10.7071 9.70711C10.8946 9.51957 11 9.26522 11 9C11 8.73478 10.8946 8.48043 10.7071 8.29289C10.5196 8.10536 10.2652 8 10 8H9C8.73478 8 8.48043 8.10536 8.29289 8.29289C8.10536 8.48043 8 8.73478 8 9C8 9.26522 8.10536 9.51957 8.29289 9.70711C8.48043 9.89464 8.73478 10 9 10V10ZM9 12C8.73478 12 8.48043 12.1054 8.29289 12.2929C8.10536 12.4804 8 12.7348 8 13C8 13.2652 8.10536 13.5196 8.29289 13.7071C8.48043 13.8946 8.73478 14 9 14H15C15.2652 14 15.5196 13.8946 15.7071 13.7071C15.8946 13.5196 16 13.2652 16 13C16 12.7348 15.8946 12.4804 15.7071 12.2929C15.5196 12.1054 15.2652 12 15 12H9ZM20 8.94C19.9896 8.84813 19.9695 8.75763 19.94 8.67V8.58C19.8919 8.47718 19.8278 8.38267 19.75 8.3V8.3L13.75 2.3C13.6673 2.22222 13.5728 2.15808 13.47 2.11C13.4402 2.10576 13.4099 2.10576 13.38 2.11C13.2784 2.05174 13.1662 2.01434 13.05 2H7C6.20435 2 5.44129 2.31607 4.87868 2.87868C4.31607 3.44129 4 4.20435 4 5V19C4 19.7956 4.31607 20.5587 4.87868 21.1213C5.44129 21.6839 6.20435 22 7 22H17C17.7956 22 18.5587 21.6839 19.1213 21.1213C19.6839 20.5587 20 19.7956 20 19V9C20 9 20 9 20 8.94ZM14 5.41L16.59 8H15C14.7348 8 14.4804 7.89464 14.2929 7.70711C14.1054 7.51957 14 7.26522 14 7V5.41ZM18 19C18 19.2652 17.8946 19.5196 17.7071 19.7071C17.5196 19.8946 17.2652 20 17 20H7C6.73478 20 6.48043 19.8946 6.29289 19.7071C6.10536 19.5196 6 19.2652 6 19V5C6 4.73478 6.10536 4.48043 6.29289 4.29289C6.48043 4.10536 6.73478 4 7 4H12V7C12 7.79565 12.3161 8.55871 12.8787 9.12132C13.4413 9.68393 14.2044 10 15 10H18V19ZM15 16H9C8.73478 16 8.48043 16.1054 8.29289 16.2929C8.10536 16.4804 8 16.7348 8 17C8 17.2652 8.10536 17.5196 8.29289 17.7071C8.48043 17.8946 8.73478 18 9 18H15C15.2652 18 15.5196 17.8946 15.7071 17.7071C15.8946 17.5196 16 17.2652 16 17C16 16.7348 15.8946 16.4804 15.7071 16.2929C15.5196 16.1054 15.2652 16 15 16Z" fill="white" />
                </svg>
              </div>

              <div className="min-w-0 [font-family:var(--font-cabinet)]">
                <div className="text-[18px] font-[650] leading-[0.75] text-white">Send report</div>
                <div className="mt-2 text-[16px] leading-[1.1] text-white/80">Send to Nikki and Alex</div>
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