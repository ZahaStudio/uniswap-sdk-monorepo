"use client";

import type { TokenInfo } from "@/lib/tokens";
import { cn } from "@/lib/utils";

interface TokenInputProps {
  label: string;
  token: TokenInfo;
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  disabled?: boolean;
  loading?: boolean;
  balance?: string;
  balanceLoading?: boolean;
  onMaxClick?: () => void;
}

export function TokenInput({
  label,
  token,
  value,
  onChange,
  readOnly = false,
  disabled = false,
  loading = false,
  balance,
  balanceLoading = false,
  onMaxClick,
}: TokenInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Allow only valid decimal numbers
    if (val === "" || /^\d*\.?\d*$/.test(val)) {
      onChange?.(val);
    }
  };

  return (
    <div className="bg-surface-raised rounded-xl p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-text-muted text-xs font-medium">{label}</span>
        {(balance !== undefined || balanceLoading) && (
          <button
            type="button"
            onClick={onMaxClick}
            disabled={!onMaxClick || disabled || balanceLoading}
            className={cn(
              "text-text-muted text-xs font-medium transition-colors",
              onMaxClick && !disabled && "hover:text-accent cursor-pointer",
              balanceLoading && "animate-pulse",
            )}
          >
            {balanceLoading ? "Balance: ..." : `Balance: ${formatBalance(balance ?? "0")} ${token.symbol}`}
          </button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <input
          type="text"
          inputMode="decimal"
          placeholder="0"
          value={value}
          onChange={handleChange}
          readOnly={readOnly}
          disabled={disabled}
          className={cn(
            "text-text placeholder:text-text-muted min-w-0 flex-1 bg-transparent text-2xl font-semibold outline-none",
            readOnly && "cursor-default",
            loading && "text-text-secondary animate-pulse",
          )}
        />

        {/* Token badge */}
        <div className="border-border-muted bg-surface flex shrink-0 items-center gap-2 rounded-full border py-1.5 pr-3 pl-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={token.logoUrl}
            alt={token.symbol}
            width={24}
            height={24}
            className="rounded-full"
            onError={(e) => {
              // Fallback to a colored circle with initial
              const target = e.currentTarget;
              target.style.display = "none";
              const parent = target.parentElement;
              if (parent && !parent.querySelector(".token-fallback")) {
                const fallback = document.createElement("div");
                fallback.className =
                  "token-fallback flex h-6 w-6 items-center justify-center rounded-full bg-accent/20 text-[10px] font-bold text-accent";
                fallback.textContent = token.symbol[0]!;
                parent.prepend(fallback);
              }
            }}
          />
          <span className="text-text text-sm font-semibold">{token.symbol}</span>
        </div>
      </div>
    </div>
  );
}

function formatBalance(value: string): string {
  const num = parseFloat(value);
  if (isNaN(num)) return "0";
  if (num === 0) return "0";
  if (num < 0.0001) return "<0.0001";
  if (num < 1) return num.toFixed(4);
  if (num < 1000) return num.toFixed(4).replace(/\.?0+$/, "");
  return num.toLocaleString("en-US", { maximumFractionDigits: 2 });
}
