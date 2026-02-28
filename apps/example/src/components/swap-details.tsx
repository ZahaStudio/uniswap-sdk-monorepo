"use client";

import { useState } from "react";

import { DetailRow } from "@/components/detail-row";
import { cn } from "@/lib/utils";

interface SwapDetailsProps {
  minOutput: string;
  outputSymbol: string;
  slippageBps: number;
}

export function SwapDetails({ minOutput, outputSymbol, slippageBps }: SwapDetailsProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-text-secondary hover:bg-surface-raised flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs transition-colors"
      >
        <span>
          Min. received:{" "}
          <span className="text-text font-medium">
            {minOutput} {outputSymbol}
          </span>
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
        <div className="bg-surface-raised/50 mt-1 space-y-2 rounded-lg px-3 py-2.5">
          <DetailRow
            label="Slippage tolerance"
            value={`${(slippageBps / 100).toFixed(2)}%`}
          />
          <DetailRow
            label="Min. received"
            value={`${minOutput} ${outputSymbol}`}
          />
          <DetailRow
            label="Route"
            value="V4 single-hop"
          />
        </div>
      )}
    </div>
  );
}
