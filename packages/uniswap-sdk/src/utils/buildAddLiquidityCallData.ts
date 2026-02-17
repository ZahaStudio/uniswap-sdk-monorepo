import { encodeSqrtRatioX96, nearestUsableTick, TickMath } from "@uniswap/v3-sdk";
import type { BatchPermitOptions, Pool } from "@uniswap/v4-sdk";
import { Position, V4PositionManager } from "@uniswap/v4-sdk";
import type { Address } from "viem";

import type { UniswapSDKInstance } from "@/core/sdk";
import { percentFromBips } from "@/helpers/percent";
import { getDefaultDeadline } from "@/utils/getDefaultDeadline";

/**
 * Parameters for building add liquidity call data.
 */
export interface BuildAddLiquidityArgs {
  /**
   * The Uniswap V4 pool to add liquidity to.
   */
  pool: Pool;

  /**
   * Amount of currency0 to add.
   */
  amount0?: string;

  /**
   * Amount of currency1 to add.
   */
  amount1?: string;

  /**
   * Address that will receive the position (NFT).
   */
  recipient: Address;

  /**
   * Lower tick boundary for the position.
   * Defaults to nearest usable MIN_TICK.
   */
  tickLower?: number;

  /**
   * Upper tick boundary for the position.
   * Defaults to nearest usable MAX_TICK.
   */
  tickUpper?: number;

  /**
   * Maximum acceptable slippage for the operation (in basis points).
   * e.g. 50 = 0.5%.
   * Defaults to 50.
   */
  slippageTolerance?: number;

  /**
   * Deadline duration in seconds from current block timestamp.
   * Defaults to the SDK instance's defaultDeadline (600 = 10 minutes).
   */
  deadlineDuration?: number;

  /**
   * Optional Permit2 batch signature for token approvals.
   */
  permit2BatchSignature?: BatchPermitOptions;
}

/**
 * Common result shape for calldata-building functions.
 * Contains the encoded calldata and the native value to send.
 */
export interface BuildCallDataResult {
  /** Encoded calldata for the transaction */
  calldata: string;
  /** Amount of native currency to send with the transaction (stringified bigint) */
  value: string;
}

/**
 * Result of building add liquidity call data.
 */
export interface BuildAddLiquidityCallDataResult extends BuildCallDataResult {}

/**
 * Builds the calldata and native value required to add liquidity to a Uniswap V4 pool.
 *
 * This function supports flexible input handling. The caller may specify:
 * - Only `amount0`
 * - Only `amount1`
 * - Or both `amount0` and `amount1`
 *
 * The behavior depends on whether the pool has existing liquidity:
 *
 * - If the pool **already has liquidity**, only one of the amounts is required.
 *   The other will be computed internally using the current price of the pool.
 *
 * - If the pool **does not have liquidity** (i.e. is being created),
 *   both `amount0` and `amount1` are required in order to compute the initial price
 *   (`sqrtPriceX96`) using `encodeSqrtRatioX96(amount1, amount0)`.
 *
 * - The amounts must be matching the pool's currency0 and currency1.
 * - The amounts must be in the same decimals as the pool's currency0 and currency1.
 *
 * The function also supports optional parameters for tick range, slippage tolerance,
 * deadline, and Permit2 batch signature for token approvals.
 *
 * @param params - The full set of parameters for building the add liquidity calldata.
 * @param instance - UniswapSDKInstance providing access to the connected RPC client.
 *
 * @returns An object containing:
 * - `calldata`: The ABI-encoded calldata for the `mint` operation.
 * - `value`: The native value (in wei, as string) to send with the transaction, if required.
 *
 * @throws If neither `amount0` nor `amount1` is provided.
 * @throws If the pool has no liquidity and only one of the amounts is provided.
 * @throws If tick bounds or permit2 data is invalid during calldata generation.
 * @example
 * ```typescript
 * const params = {
 *   pool: pool,
 *   amount0: parseUnits("100", 6), // 100 USDC
 *   amount1: parseEther("0.04"), // 0.04 WETH
 *   recipient: "0x...",
 *   ... // other optional params
 * };
 *
 * const { calldata, value } = await buildAddLiquidityCallData(params, instance);
 *
 * // Send transaction
 * const tx = await sendTransaction({
 *   to: V4PositionManager.address,
 *   data: calldata,
 *   value,
 * });
 * ```
 */

export async function buildAddLiquidityCallData(
  params: BuildAddLiquidityArgs,
  instance: UniswapSDKInstance,
): Promise<BuildAddLiquidityCallDataResult> {
  const {
    pool,
    amount0,
    amount1,
    recipient,
    tickLower: tickLowerParam,
    tickUpper: tickUpperParam,
    slippageTolerance = instance.defaultSlippageTolerance,
    deadlineDuration,
    permit2BatchSignature,
  } = params;

  if (slippageTolerance < 0 || slippageTolerance > 10_000) {
    throw new Error(
      `Invalid slippageTolerance: ${slippageTolerance}. Must be between 0 and 10000 basis points (0-100%).`,
    );
  }

  if (amount0 !== undefined && (amount0 === "" || BigInt(amount0) < 0n)) {
    throw new Error(`Invalid amount0: ${amount0}. Must be a non-negative integer string.`);
  }

  if (amount1 !== undefined && (amount1 === "" || BigInt(amount1) < 0n)) {
    throw new Error(`Invalid amount1: ${amount1}. Must be a non-negative integer string.`);
  }

  const deadline = await getDefaultDeadline(instance, deadlineDuration);

  const slippagePercent = percentFromBips(slippageTolerance);
  const createPool = pool.liquidity.toString() === "0";

  const tickLower = tickLowerParam ?? nearestUsableTick(TickMath.MIN_TICK, pool.tickSpacing);
  const tickUpper = tickUpperParam ?? nearestUsableTick(TickMath.MAX_TICK, pool.tickSpacing);

  if (tickLower >= tickUpper) {
    throw new Error(`tickLower (${tickLower}) must be less than tickUpper (${tickUpper}).`);
  }

  if (tickLower % pool.tickSpacing !== 0) {
    throw new Error(`tickLower (${tickLower}) is not a multiple of tickSpacing (${pool.tickSpacing}).`);
  }
  if (tickUpper % pool.tickSpacing !== 0) {
    throw new Error(`tickUpper (${tickUpper}) is not a multiple of tickSpacing (${pool.tickSpacing}).`);
  }

  let sqrtPriceX96: string;
  if (createPool) {
    if (!amount0 || !amount1) {
      throw new Error("Both amount0 and amount1 are required when creating a new pool.");
    }
    sqrtPriceX96 = encodeSqrtRatioX96(amount1, amount0).toString();
  } else {
    sqrtPriceX96 = pool.sqrtRatioX96.toString();
  }

  // Build position
  let position: Position;
  if (amount0 && amount1) {
    position = Position.fromAmounts({
      pool,
      tickLower,
      tickUpper,
      amount0,
      amount1,
      useFullPrecision: true,
    });
  } else if (amount0) {
    position = Position.fromAmount0({
      pool,
      tickLower,
      tickUpper,
      amount0,
      useFullPrecision: true,
    });
  } else if (amount1) {
    position = Position.fromAmount1({
      pool,
      tickLower,
      tickUpper,
      amount1,
    });
  } else {
    throw new Error("Invalid input: at least one of amount0 or amount1 must be defined.");
  }

  // Build calldata
  const { calldata, value } = V4PositionManager.addCallParameters(position, {
    recipient,
    deadline: deadline.toString(),
    slippageTolerance: slippagePercent,
    createPool,
    sqrtPriceX96,
    useNative: pool.currency0.isNative ? pool.currency0 : undefined, // Only token0 can be native
    batchPermit: permit2BatchSignature,
  });

  return {
    calldata,
    value,
  };
}
