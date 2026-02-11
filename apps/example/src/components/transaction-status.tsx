"use client";

import type { TransactionStatus as TxStatus } from "@zahastudio/uniswap-sdk-react";

import { cn } from "@/lib/utils";

interface TransactionStatusProps {
  status: TxStatus;
  txHash?: `0x${string}`;
}

export function TransactionStatus({ status, txHash }: TransactionStatusProps) {
  const etherscanUrl = txHash ? `https://otterscan-devnet.metacrypt.org/tx/${txHash}` : undefined;

  const config = {
    idle: {
      icon: null,
      label: "",
      color: "text-text-muted",
      bg: "bg-surface",
    },
    pending: {
      icon: (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          className="animate-spin"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray="60"
            strokeDashoffset="15"
            strokeLinecap="round"
          />
        </svg>
      ),
      label: "Waiting for wallet confirmation...",
      color: "text-warning",
      bg: "bg-warning-muted",
    },
    confirming: {
      icon: (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          className="animate-spin"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray="60"
            strokeDashoffset="15"
            strokeLinecap="round"
          />
        </svg>
      ),
      label: "Transaction submitted, waiting for confirmation...",
      color: "text-accent",
      bg: "bg-accent-muted",
    },
    confirmed: {
      icon: (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
        >
          <path
            d="M20 6L9 17l-5-5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
      label: "Swap confirmed!",
      color: "text-success",
      bg: "bg-success-muted",
    },
    error: {
      icon: (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
        >
          <path
            d="M18 6L6 18M6 6l12 12"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
      label: "Transaction failed",
      color: "text-error",
      bg: "bg-error-muted",
    },
  };

  const c = config[status];
  if (status === "idle") return null;

  return (
    <div className={cn("border-border-muted flex items-center gap-3 rounded-xl border p-4", c.bg)}>
      <div className={c.color}>{c.icon}</div>
      <div className="min-w-0 flex-1">
        <div className={cn("text-xs font-medium", c.color)}>{c.label}</div>
        {txHash && (
          <a
            href={etherscanUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-text-muted hover:text-text-secondary mt-0.5 block truncate font-mono text-[10px] transition-colors"
          >
            {txHash}
          </a>
        )}
      </div>
      {etherscanUrl && (
        <a
          href={etherscanUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="border-border-muted text-text-secondary hover:bg-surface-hover hover:text-text shrink-0 rounded-lg border px-2.5 py-1 text-[10px] font-medium transition-all"
        >
          View
        </a>
      )}
    </div>
  );
}
