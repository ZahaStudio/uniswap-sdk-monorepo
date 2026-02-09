/**
 * Package key used as prefix for all query keys to ensure uniqueness.
 */
const PACKAGE_KEY = "@zahastudio/uniswap-sdk-react" as const;

/**
 * Query key factory for position-related queries.
 * Enables efficient cache invalidation and prefetching.
 */
export const positionKeys = {
  /** Base key for all position queries */
  all: [PACKAGE_KEY, "usePosition"] as const,

  /** Key for a specific position by tokenId and chainId */
  detail: (tokenId: string, chainId?: number) => [...positionKeys.all, tokenId, chainId] as const,
};

/**
 * Query key factory for swap-related queries.
 * Enables efficient cache invalidation and prefetching.
 */
export const swapKeys = {
  /** Base key for all swap queries */
  all: [PACKAGE_KEY, "useSwap"] as const,

  /** Key for a swap quote by pool key, amount, direction, slippage, and chain */
  quote: (
    poolKey: { currency0: string; currency1: string; fee: number; tickSpacing: number; hooks: string },
    amountIn: bigint,
    zeroForOne: boolean,
    slippageBps: number,
    chainId?: number,
  ) =>
    [
      ...swapKeys.all,
      "quote",
      poolKey.currency0,
      poolKey.currency1,
      poolKey.fee,
      poolKey.tickSpacing,
      poolKey.hooks,
      amountIn,
      zeroForOne,
      slippageBps,
      chainId,
    ] as const,
};
