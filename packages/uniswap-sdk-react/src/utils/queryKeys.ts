import { TradeType, type SwapRoute } from "@zahastudio/uniswap-sdk";

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
 * Query key factory for pool-related queries.
 * Enables efficient cache invalidation and prefetching.
 */
export const poolKeys = {
  /** Base key for all pool queries */
  all: [PACKAGE_KEY, "usePool"] as const,

  /** Key for a specific pool by currency pair, fee, tick spacing, hooks, and chainId */
  detail: (currencyA: string, currencyB: string, fee: number, tickSpacing?: number, hooks?: string, chainId?: number) =>
    [...poolKeys.all, currencyA, currencyB, fee, tickSpacing, hooks, chainId] as const,
};

/**
 * Query key factory for token-related queries.
 * Enables efficient cache invalidation and prefetching.
 */
export const tokenKeys = {
  /** Base key for all token queries */
  all: [PACKAGE_KEY, "useToken"] as const,

  /** Key for a specific token by address, account, and chainId */
  detail: (tokenAddress: string, account?: string, chainId?: number) =>
    [...tokenKeys.all, tokenAddress, account, chainId] as const,
};

/**
 * Query key factory for swap-related queries.
 * Enables efficient cache invalidation and prefetching.
 */
export const swapKeys = {
  /** Base key for all swap queries */
  all: [PACKAGE_KEY, "useSwap"] as const,

  /** Key for a swap quote by trade type, exact-side currency, ordered route, amount, slippage, and chain. */
  quote: (
    tradeType: typeof TradeType.ExactInput | typeof TradeType.ExactOutput,
    exactCurrency: string,
    route: SwapRoute,
    exactAmount: bigint,
    slippageBps: number,
    chainId?: number,
  ) =>
    [
      ...swapKeys.all,
      "quote",
      tradeType,
      exactCurrency,
      ...route.flatMap(({ poolKey, hookData }) => [
        poolKey.currency0,
        poolKey.currency1,
        poolKey.fee,
        poolKey.tickSpacing,
        poolKey.hooks,
        hookData ?? "0x",
      ]),
      exactAmount,
      slippageBps,
      chainId,
    ] as const,
};
