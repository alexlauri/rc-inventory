"use client";

import BackLinkButton from "./BackLinkButton";

type PageHeaderProps = {
  title: string;
  backHref?: string;
  className?: string;
  titleClassName?: string;
};

export default function PageHeader({
  title,
  backHref = "/",
  className = "",
  titleClassName = "",
}: PageHeaderProps) {
  return (
    <div className={`relative flex h-12 items-center justify-center px-4 ${className}`}>
      {/* Back button */}
      <div className="absolute -left-3 flex h-10 w-10 items-center justify-center">
        <BackLinkButton href={backHref} />
      </div>

      {/* Centered title */}
      <h1 className={`text-[18px] font-medium leading-none text-current [font-family:var(--font-cabinet)] ${titleClassName}`}>
        {title}
      </h1>
    </div>
  );
}