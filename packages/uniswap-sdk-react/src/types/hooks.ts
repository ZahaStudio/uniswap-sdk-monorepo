/**
 * Common configuration options shared by all Uniswap SDK React hooks.
 */
export interface UseHookOptions {
  /**
   * Chain ID to use. If omitted, uses the currently connected chain.
   * SDK instances are cached by the nearest provider using only this chainId.
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

/**
 * Configuration options for mutation-style hooks (create position, increase/remove liquidity, collect fees).
 * Extends UseHookOptions with an onSuccess callback.
 */
export interface UseMutationHookOptions extends Pick<UseHookOptions, "chainId"> {
  /** Callback fired when the transaction is confirmed */
  onSuccess?: () => void;
}
