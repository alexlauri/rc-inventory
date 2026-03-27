"use client";

import Link from "next/link";

type Props = {
  href?: string;
  onClick?: () => void;
};

export default function BackLinkButton({ href, onClick }: Props) {
  const content = (
    <div className="flex h-10 w-10 items-center justify-center">
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return (
    <button type="button" onClick={onClick}>
      {content}
    </button>
  );
}