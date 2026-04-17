"use client";

import { useState } from "react";

import { DetailRow } from "@/components/detail-row";
import { cn } from "@/lib/utils";

interface SwapDetailsProps {
  tradeType: "exactInput" | "exactOutput";
  inputSymbol: string;
  outputSymbol: string;
  slippageBps: number;
  routeLabel: string;
  minOutput?: string;
  maxInput?: string;
}

export function SwapDetails({
  tradeType,
  inputSymbol,
  outputSymbol,
  slippageBps,
  routeLabel,
  minOutput,
  maxInput,
}: SwapDetailsProps) {
  const [expanded, setExpanded] = useState(false);
  const primaryLabel = tradeType === "exactOutput" ? "Max. sold" : "Min. received";
  const primaryValue =
    tradeType === "exactOutput" ? `${maxInput ?? "0"} ${inputSymbol}` : `${minOutput ?? "0"} ${outputSymbol}`;

  return (
    <div className="mt-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs text-text-secondary transition-colors hover:bg-surface-raised"
      >
        <span>
          {primaryLabel}: <span className="font-medium text-text">{primaryValue}</span>
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          className={cn("transition-transform", expanded && "rotate-180")}
        >
          <path
            d="M6 9l6 6 6-6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {expanded && (
        <div className="mt-1 space-y-2 rounded-lg bg-surface-raised/50 px-3 py-2.5">
          <DetailRow
            label="Slippage tolerance"
            value={`${(slippageBps / 100).toFixed(2)}%`}
          />
          <DetailRow
            label={primaryLabel}
            value={primaryValue}
          />
          <DetailRow
            label="Route"
            value={routeLabel}
          />
        </div>
      )}
    </div>
  );
}
