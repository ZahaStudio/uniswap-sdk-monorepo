/**
 * Sorts two tokens in a consistent order (lexicographically by address)
 * @param currency0 First currency/token address
 * @param currency1 Second currency/token address
 * @returns Tuple of [currency0, currency1] in sorted order
 */
export function sortTokens(currency0: `0x${string}`, currency1: `0x${string}`): [`0x${string}`, `0x${string}`] {
  return currency0.toLowerCase() < currency1.toLowerCase() ? [currency0, currency1] : [currency1, currency0];
}
