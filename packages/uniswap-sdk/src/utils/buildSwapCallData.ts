import type { PermitSingle } from "@uniswap/permit2-sdk";
import { Actions, V4Planner } from "@uniswap/v4-sdk";
import { ethers } from "ethers";
import type { Hex } from "viem";

import { type BuildSwapCallDataArgs, COMMANDS } from "@/types";

const buildPermit2StructInput = (permit: PermitSingle, signature: Hex) => {
  return ethers.utils.defaultAbiCoder.encode(
    [
      "tuple(" +
        "tuple(address token,uint160 amount,uint48 expiration,uint48 nonce) details," +
        "address spender," +
        "uint256 sigDeadline" +
        ")",
      "bytes",
    ],
    [permit, signature],
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

  let commands = ethers.utils.solidityPack(["uint8"], [COMMANDS.V4_SWAP]);

  if (permit2Signature) {
    commands = ethers.utils.solidityPack(["uint8", "uint8"], [COMMANDS.PERMIT2_PERMIT, COMMANDS.V4_SWAP]);
  }

  // Combine actions and params into a single bytes array to match with V4_SWAP command input
  let inputs = [ethers.utils.defaultAbiCoder.encode(["bytes", "bytes[]"], [planner.actions, planner.params])];

  // If permit2Signature is provided, add the permit2 struct input to the inputs array in the first position
  if (permit2Signature) {
    inputs = [
      buildPermit2StructInput(permit2Signature.permit, permit2Signature.signature),
      ethers.utils.defaultAbiCoder.encode(["bytes", "bytes[]"], [planner.actions, planner.params]),
    ];
  }

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 5); // 5 minutes

  const universalRouterInterface = new ethers.utils.Interface([
    "function execute(bytes commands, bytes[] inputs, uint256 deadline)",
  ]);

  // Encode final calldata
  return universalRouterInterface.encodeFunctionData("execute", [commands, inputs, deadline]) as Hex;
}
