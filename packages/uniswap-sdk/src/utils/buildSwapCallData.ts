import type { PermitSingle } from "@uniswap/permit2-sdk";
import { Actions, V4Planner } from "@uniswap/v4-sdk";
import type { Pool } from "@uniswap/v4-sdk";
import { utility } from "hookmate/abi";
import type { Address, Hex } from "viem";
import { encodeAbiParameters, encodeFunctionData, encodePacked, parseAbiParameters } from "viem";

/**
 * Command codes for Universal Router operations
 * @see https://docs.uniswap.org/contracts/universal-router/technical-reference
 */
export const COMMANDS = {
  PERMIT2_PERMIT: 0x0a,
  SWAP_EXACT_IN_SINGLE: 0x06,
  SETTLE_ALL: 0x0c,
  TAKE_ALL: 0x0f,
  V4_SWAP: 0x10,
} as const;

/**
 * Parameters for building a V4 swap
 */
export type BuildSwapCallDataArgs = {
  amountIn: bigint;
  amountOutMinimum: bigint;
  pool: Pool;
  /** The direction of the swap, true for currency0 to currency1, false for currency1 to currency0 */
  zeroForOne: boolean;
  //slippageTolerance?: number
  recipient: Address;
  permit2Signature?: {
    signature: Hex;
    owner: Address;
    permit: PermitSingle;
  };
  /** Custom actions to override default swap behavior. If not provided, uses default SWAP_EXACT_IN_SINGLE */
  customActions?: {
    action: Actions;
    parameters: unknown[];
  }[];
};

const buildPermit2StructInput = (permit: PermitSingle, signature: Hex): Hex => {
  return encodeAbiParameters(
    parseAbiParameters([
      "(((address token, uint160 amount, uint48 expiration, uint48 nonce) details, address spender, uint256 sigDeadline) permit, bytes signature)",
    ]),
    [
      {
        permit: {
          details: {
            token: permit.details.token as `0x${string}`,
            amount: BigInt(permit.details.amount.toString()),
            expiration: Number(permit.details.expiration),
            nonce: Number(permit.details.nonce),
          },
          spender: permit.spender as `0x${string}`,
          sigDeadline: BigInt(permit.sigDeadline.toString()),
        },
        signature,
      },
    ],
  );
};

/**
 * Builds calldata for a Uniswap V4 swap
 *
 * This function creates the necessary calldata to execute a token swap through
 * Uniswap V4's Universal Router.
 *
 * @param params - Swap configuration parameters
 * @returns encoded calldata
 */
export function buildSwapCallData(params: BuildSwapCallDataArgs): Hex {
  const { amountIn, pool, zeroForOne, permit2Signature, recipient, amountOutMinimum, customActions } = params;

  const planner = new V4Planner();

  // Use custom actions if provided, otherwise use default SWAP_EXACT_IN_SINGLE
  if (customActions && customActions.length > 0) {
    // Add custom actions to the planner
    for (const customAction of customActions) {
      planner.addAction(customAction.action, customAction.parameters);
    }
  } else {
    planner.addAction(Actions.SWAP_EXACT_IN_SINGLE, [
      {
        poolKey: pool.poolKey,
        zeroForOne,
        amountIn: amountIn.toString(),
        amountOutMinimum: amountOutMinimum.toString(),
        hookData: "0x",
      },
    ]);

    const currencyIn = zeroForOne ? pool.currency0 : pool.currency1;
    const currencyOut = zeroForOne ? pool.currency1 : pool.currency0;

    // Add settle and take actions for default behavior
    planner.addSettle(currencyIn, true);
    planner.addTake(currencyOut, recipient);
  }

  let commands: Hex = encodePacked(["uint8"], [COMMANDS.V4_SWAP]);

  if (permit2Signature) {
    commands = encodePacked(["uint8", "uint8"], [COMMANDS.PERMIT2_PERMIT, COMMANDS.V4_SWAP]);
  }

  // Combine actions and params into a single bytes array to match with V4_SWAP command input
  const v4SwapInput = encodeAbiParameters(parseAbiParameters("bytes, bytes[]"), [
    planner.actions as Hex,
    planner.params as Hex[],
  ]);

  let inputs: Hex[] = [v4SwapInput];

  // If permit2Signature is provided, add the permit2 struct input to the inputs array in the first position
  if (permit2Signature) {
    inputs = [buildPermit2StructInput(permit2Signature.permit, permit2Signature.signature), v4SwapInput];
  }

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 5); // 5 minutes

  // Encode final calldata
  return encodeFunctionData({
    abi: utility.UniversalRouterArtifact.abi,
    functionName: "execute",
    args: [commands, inputs, deadline],
  });
}
