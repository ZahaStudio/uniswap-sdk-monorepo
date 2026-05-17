import { formatUnits, parseUnits } from "viem";

export function normalizeAmountInput(value: string) {
  const normalized = value.replace(/[^\d.]/g, "");
  const [whole = "", ...fractionParts] = normalized.split(".");
  const fraction = fractionParts.join("");

  if (normalized.startsWith(".")) {
    return `0.${fraction}`;
  }

  return fractionParts.length > 0 ? `${whole}.${fraction}` : whole;
}

export function parseTokenAmount(value: string, decimals: number): bigint | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return 0n;
  }

  try {
    return parseUnits(trimmed, decimals);
  } catch {
    return null;
  }
}

export function formatTokenAmount(value: bigint | undefined, decimals: number, maximumFractionDigits = 6) {
  if (value === undefined) {
    return "";
  }

  const formatted = formatUnits(value, decimals);
  const numeric = Number(formatted);

  if (!Number.isFinite(numeric)) {
    return formatted;
  }

  if (numeric > 0 && numeric < 0.000001) {
    return "<0.000001";
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits,
  }).format(numeric);
}

export function formatQuoteTimestamp(timestamp: number | undefined) {
  if (!timestamp) {
    return "Not quoted yet";
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(timestamp));
}

export function formatBps(value: number) {
  return `${value / 100}%`;
}
