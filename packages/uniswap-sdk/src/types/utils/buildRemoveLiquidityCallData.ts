/**
 * Parameters required to build the calldata for removing liquidity from a Uniswap v4 position.
 */
export interface BuildRemoveLiquidityCallDataArgs {
  /**
   * The percentage of liquidity to remove from the position.
   */
  liquidityPercentage: number;

  /**
   * The tokenId of the position to remove liquidity from.
   */
  tokenId: string;

  /**
   * The slippage tolerance for the transaction.
   */
  slippageTolerance?: number;

  /**
   * The deadline for the transaction. (default: 5 minutes from now)
   */
  deadline?: string;
}
