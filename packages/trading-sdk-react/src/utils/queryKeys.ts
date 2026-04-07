const PACKAGE_KEY = "@zahastudio/trading-sdk-react" as const;

export const tradingKeys = {
  all: [PACKAGE_KEY, "useTrading"] as const,
  quote: (params: {
    tokenIn: string;
    tokenOut: string;
    amountIn: bigint;
    chainId: number;
    swapper?: string;
    permit2Disabled: boolean;
    slippageTolerance?: number;
    autoSlippage?: string;
    urgency?: string;
    routingPreference?: string;
  }) =>
    [
      ...tradingKeys.all,
      "quote",
      params.tokenIn,
      params.tokenOut,
      params.amountIn,
      params.chainId,
      params.swapper,
      params.permit2Disabled,
      params.slippageTolerance,
      params.autoSlippage,
      params.urgency,
      params.routingPreference,
    ] as const,
  approval: (params: {
    walletAddress?: string;
    tokenIn: string;
    tokenOut: string;
    amountIn: bigint;
    chainId: number;
    permit2Disabled: boolean;
    urgency?: string;
  }) =>
    [
      ...tradingKeys.all,
      "approval",
      params.walletAddress,
      params.tokenIn,
      params.tokenOut,
      params.amountIn,
      params.chainId,
      params.permit2Disabled,
      params.urgency,
    ] as const,
};
