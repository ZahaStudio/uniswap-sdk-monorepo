"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

export function Header() {
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

      <ConnectButton />
    </header>
  );
}
