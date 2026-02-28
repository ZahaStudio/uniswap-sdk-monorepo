"use client";

import { useToken } from "@zahastudio/uniswap-sdk-react";
import type { Address } from "viem";

import type { PoolPreset } from "@/lib/tokens";
import { cn } from "@/lib/utils";

export function PoolTab({
  preset,
  isSelected,
  onClick,
}: {
  preset: PoolPreset;
  isSelected: boolean;
  onClick: () => void;
}) {
  const { query: c0 } = useToken({ tokenAddress: preset.poolKey.currency0 as Address }, { enabled: true, chainId: 1 });
  const { query: c1 } = useToken({ tokenAddress: preset.poolKey.currency1 as Address }, { enabled: true, chainId: 1 });

  const label = c0.data && c1.data ? `${c0.data.token.symbol} / ${c1.data.token.symbol}` : "...";

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all",
        isSelected
          ? "border-accent/30 bg-accent-muted text-accent"
          : "border-border-muted bg-surface text-text-secondary hover:border-border hover:bg-surface-hover",
      )}
    >
      {label}
    </button>
  );
}
