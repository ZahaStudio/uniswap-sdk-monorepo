/**
 * Common configuration options shared by all Uniswap SDK React hooks.
 */
export interface UseHookOptions {
  /**
   * Chain ID to use. If omitted, uses the currently connected chain.
   * The SDK instance is cached per chain, so passing the same chainId
   * across multiple hooks reuses the same instance.
   */
  chainId?: number;

  /** Whether the query is enabled (default: true) */
  enabled?: boolean;

  /**
   * Refetch interval in milliseconds.
   * Set to a number to poll, or false to disable.
   * Recommend: 12000 (12 seconds, ~1 Ethereum block)
   */
  refetchInterval?: number | false;
}
