/**
 * Parameters required to build the calldata for collecting fees from a Uniswap v4 position.
 */
export interface BuildCollectFeesCallDataArgs {
  /**
   * The tokenId of the position to collect fees from.
   */
  tokenId: string;

  /**
   * The recipient address for collected fees.
   */
  recipient: string;

  /**
   * Optional deadline for the transaction (default: 5 minutes from now).
   */
  deadline?: string;
}
