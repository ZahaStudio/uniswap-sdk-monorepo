export function toAmountString(amount: bigint | string): string {
  const normalized = typeof amount === "bigint" ? amount : BigInt(amount);
  if (normalized <= 0n) {
    throw new Error("Amount must be greater than zero.");
  }

  return normalized.toString();
}
