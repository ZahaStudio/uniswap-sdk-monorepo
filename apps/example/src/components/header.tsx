"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const TABS = [
  { href: "/swap", label: "Swap" },
  { href: "/position", label: "Position" },
  { href: "/create-position", label: "Create Position" },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="bg-accent/10 flex h-9 w-9 items-center justify-center rounded-lg">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
          >
            <path
              d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-accent"
            />
          </svg>
        </div>
        <div>
          <span className="text-text text-sm font-semibold">Uniswap SDK</span>
          <span className="bg-accent/10 text-accent ml-1.5 rounded px-1.5 py-0.5 text-[10px] font-medium">EXAMPLE</span>
        </div>
      </div>

      <nav className="flex justify-center gap-1.5">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "rounded-lg px-5 py-2 text-sm font-medium transition-all",
              pathname === tab.href
                ? "border-accent/30 bg-accent-muted text-accent border"
                : "text-text-secondary hover:text-text hover:bg-surface-hover border border-transparent",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <ConnectButton />
    </header>
  );
}
