"use client";

import { useCallback, useRef, useState } from "react";

import { PERMIT2_ADDRESS, type PreparePermit2BatchDataResult } from "@zahastudio/uniswap-sdk";
import type { Address, Hex } from "viem";
import { zeroAddress } from "viem";
import { useAccount, useSignTypedData } from "wagmi";

import { useTokenApproval, type UseTokenApprovalReturn } from "@/hooks/primitives/useTokenApproval";
import { useTransaction, type UseTransactionReturn } from "@/hooks/primitives/useTransaction";
import { usePosition, type UsePositionParams } from "@/hooks/usePosition";
import { useUniswapSDK } from "@/hooks/useUniswapSDK";

/**
 * Arguments for increasing liquidity on a position.
 */
export interface IncreaseLiquidityArgs {
  /** Amount of token0 to add (as string) */
  amount0?: string;
  /** Amount of token1 to add (as string) */
  amount1?: string;
  /** Recipient address for the position NFT */
  recipient: string;
  /** Slippage tolerance in basis points (optional, default: 50 = 0.5%) */
  slippageTolerance?: number;
  /** Unix timestamp deadline (optional, default: 30 minutes from now) */
  deadline?: string;
}

/**
 * Permit2 batch signing step state.
 */
export interface UsePositionPermit2Step {
  /** Whether permit2 signing is required (false when both tokens are native) */
  isRequired: boolean;
  /** Whether the wallet signature prompt is pending */
  isPending: boolean;
  /** Whether the permit2 has been signed */
  isSigned: boolean;
  /** Error from the signing step */
  error: Error | undefined;
  /** Initiate permit2 batch preparation and signing */
  sign: () => Promise<void>;
  /** Reset the permit2 step */
  reset: () => void;
}

/**
 * Current step in the increase liquidity lifecycle.
 */
export type IncreaseLiquidityStep = "approval0" | "approval1" | "permit2" | "execute" | "completed";

/**
 * Options for the usePositionIncreaseLiquidity hook.
 */
export interface UsePositionIncreaseLiquidityOptions {
  /** Override chain ID */
  chainId?: number;
  /** Amount of token0 for proactive approval checking */
  amount0?: bigint;
  /** Amount of token1 for proactive approval checking */
  amount1?: bigint;
  /** Callback fired when the transaction is confirmed */
  onSuccess?: () => void;
}

/**
 * Return type for the usePositionIncreaseLiquidity hook.
 */
export interface UsePositionIncreaseLiquidityReturn {
  /** All pipeline steps with individual state and actions */
  steps: {
    /** ERC-20 → Permit2 approval for token0 */
    approvalToken0: UseTokenApprovalReturn;
    /** ERC-20 → Permit2 approval for token1 */
    approvalToken1: UseTokenApprovalReturn;
    /** Off-chain Permit2 batch signature step */
    permit2: UsePositionPermit2Step;
    /** Increase liquidity transaction execution step */
    execute: {
      transaction: UseTransactionReturn;
      execute: (args: IncreaseLiquidityArgs) => Promise<Hex>;
    };
  };
  /** The first incomplete required step */
  currentStep: IncreaseLiquidityStep;
  /** Execute all remaining required steps sequentially. Returns tx hash. */
  executeAll: (args: IncreaseLiquidityArgs) => Promise<Hex>;
  /** Reset all mutation state (approvals, permit2, transaction) */
  reset: () => void;
}

/**
 * Hook to increase liquidity on an existing Uniswap V4 position.
 *
 * Internally loads the position via `usePosition` and orchestrates ERC-20
 * approvals (to Permit2), off-chain Permit2 batch signing, and the increase
 * liquidity transaction. Automatically detects which steps are required
 * (e.g. native ETH skips approval and permit2) and refetches position data
 * when the transaction confirms.
 *
 * @param params - Operation parameters: tokenId
 * @param options - Configuration: amounts for approval checking, chainId, onSuccess
 * @returns Pipeline steps, current step indicator, executeAll action, and reset
 *
 * @example Step-by-step control
 * ```tsx
 * const increase = usePositionIncreaseLiquidity({ tokenId }, {
 *   amount0: parseUnits("100", 6),
 * });
 *
 * if (increase.steps.approvalToken0.isRequired) {
 *   await increase.steps.approvalToken0.approve();
 *   await increase.steps.approvalToken0.transaction.waitForConfirmation();
 * }
 * await increase.steps.permit2.sign();
 * await increase.steps.execute.execute({ amount0: "100", recipient: address });
 * ```
 *
 * @example One-click with executeAll
 * ```tsx
 * const increase = usePositionIncreaseLiquidity({ tokenId }, {
 *   amount0: parseUnits("100", 6),
 * });
 * const txHash = await increase.executeAll({ amount0: "100", recipient: address });
 * ```
 */
export function usePositionIncreaseLiquidity(
  params: UsePositionParams,
  options: UsePositionIncreaseLiquidityOptions = {},
): UsePositionIncreaseLiquidityReturn {
  const { tokenId } = params;
  const { chainId: overrideChainId, amount0 = 0n, amount1 = 0n, onSuccess } = options;

  // ── SDK & Wallet ─────────────────────────────────────────────────────────
  const { sdk, chainId } = useUniswapSDK({ chainId: overrideChainId });
  const { address: connectedAddress } = useAccount();
  const { query } = usePosition({ tokenId }, { chainId: overrideChainId });

  const position = query.data;

  // ── Derive token addresses from position data ───────────────────────────
  const token0Address = (
    position?.currency0?.isNative ? zeroAddress : (position?.currency0?.wrapped?.address ?? zeroAddress)
  ) as Address;
  const token1Address = (
    position?.currency1?.isNative ? zeroAddress : (position?.currency1?.wrapped?.address ?? zeroAddress)
  ) as Address;

  const hasNonNativeToken0 = token0Address.toLowerCase() !== zeroAddress.toLowerCase();
  const hasNonNativeToken1 = token1Address.toLowerCase() !== zeroAddress.toLowerCase();

  // ── Transaction ──────────────────────────────────────────────────────────
  const transaction = useTransaction({
    onSuccess: () => {
      query.refetch();
      onSuccess?.();
    },
  });

  // ── Token Approvals ─────────────────────────────────────────────────────
  const approvalEnabled = !!position;

  const approvalToken0 = useTokenApproval(
    {
      token: token0Address,
      spender: PERMIT2_ADDRESS as Address,
      amount: amount0,
    },
    {
      enabled: approvalEnabled,
      chainId,
    },
  );

  const approvalToken1 = useTokenApproval(
    {
      token: token1Address,
      spender: PERMIT2_ADDRESS as Address,
      amount: amount1,
    },
    {
      enabled: approvalEnabled,
      chainId,
    },
  );

  // ── Permit2 Batch Sign ──────────────────────────────────────────────────
  const signTypedData = useSignTypedData();
  const permit2BatchDataRef = useRef<
    ReturnType<PreparePermit2BatchDataResult["buildPermit2BatchDataWithSignature"]> | undefined
  >(undefined);
  const [permit2Error, setPermit2Error] = useState<Error | undefined>(undefined);

  const permit2IsRequired = hasNonNativeToken0 || hasNonNativeToken1;

  const permit2Sign = useCallback(async () => {
    if (!permit2IsRequired) {
      return;
    }
    if (!connectedAddress) {
      throw new Error("No wallet connected");
    }
    if (!sdk) {
      throw new Error("SDK not initialized");
    }

    try {
      setPermit2Error(undefined);

      const positionManager = sdk.getContractAddress("positionManager");

      const tokens: Address[] = [];
      if (hasNonNativeToken0) tokens.push(token0Address);
      if (hasNonNativeToken1) tokens.push(token1Address);

      const prepareResult = await sdk.preparePermit2BatchData({
        tokens,
        spender: positionManager,
        owner: connectedAddress,
        sigDeadline: Math.floor(Date.now() / 1000) + 60 * 15,
      });

      const signature = await signTypedData.signTypedDataAsync({
        domain: prepareResult.toSign.domain,
        types: prepareResult.toSign.types,
        primaryType: prepareResult.toSign.primaryType,
        message: prepareResult.toSign.message,
      });

      permit2BatchDataRef.current = prepareResult.buildPermit2BatchDataWithSignature(signature);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setPermit2Error(error);
      throw error;
    }
  }, [
    permit2IsRequired,
    connectedAddress,
    sdk,
    hasNonNativeToken0,
    hasNonNativeToken1,
    token0Address,
    token1Address,
    signTypedData,
  ]);

  const permit2Reset = useCallback(() => {
    permit2BatchDataRef.current = undefined;
    setPermit2Error(undefined);
    signTypedData.reset();
  }, [signTypedData]);

  const permit2Step: UsePositionPermit2Step = {
    isRequired: permit2IsRequired,
    isPending: signTypedData.isPending,
    isSigned: !!permit2BatchDataRef.current,
    error: permit2Error,
    sign: permit2Sign,
    reset: permit2Reset,
  };

  // ── Execute ─────────────────────────────────────────────────────────────
  const execute = useCallback(
    async (args: IncreaseLiquidityArgs): Promise<Hex> => {
      if (!position) {
        throw new Error("Position not loaded. Wait for query to complete before increasing liquidity.");
      }
      if (!sdk) {
        throw new Error("SDK not initialized");
      }
      if (permit2Step.isRequired && !permit2BatchDataRef.current) {
        throw new Error("Permit2 signature required");
      }

      const positionManager = sdk.getContractAddress("positionManager");
      const { calldata, value } = await sdk.buildAddLiquidityCallData({
        pool: position.pool,
        tickLower: position.position.tickLower,
        tickUpper: position.position.tickUpper,
        amount0: args.amount0,
        amount1: args.amount1,
        recipient: args.recipient,
        slippageTolerance: args.slippageTolerance,
        deadline: args.deadline,
        permit2BatchSignature: permit2BatchDataRef.current,
      });

      return transaction.sendTransaction({
        to: positionManager,
        data: calldata as Hex,
        value: BigInt(value),
      });
    },
    [position, sdk, permit2Step.isRequired, transaction],
  );

  // ── executeAll ──────────────────────────────────────────────────────────
  const executeAll = useCallback(
    async (args: IncreaseLiquidityArgs): Promise<Hex> => {
      // Step 1: Token0 approval (if required)
      if (approvalToken0.isRequired && !approvalToken0.transaction.isConfirmed) {
        await approvalToken0.approve();
        await approvalToken0.transaction.waitForConfirmation();
      }

      // Step 2: Token1 approval (if required)
      if (approvalToken1.isRequired && !approvalToken1.transaction.isConfirmed) {
        await approvalToken1.approve();
        await approvalToken1.transaction.waitForConfirmation();
      }

      // Step 3: Permit2 batch sign (if required and not already signed)
      if (permit2Step.isRequired && !permit2Step.isSigned) {
        await permit2Sign();
      }

      // Step 4: Execute increase liquidity transaction
      return execute(args);
    },
    [approvalToken0, approvalToken1, permit2Step.isRequired, permit2Step.isSigned, permit2Sign, execute],
  );

  // ── Derive currentStep ──────────────────────────────────────────────────
  const currentStep: IncreaseLiquidityStep = (() => {
    if (approvalToken0.isRequired === undefined || approvalToken0.isRequired) {
      return "approval0";
    }
    if (approvalToken1.isRequired === undefined || approvalToken1.isRequired) {
      return "approval1";
    }
    if (permit2Step.isRequired && !permit2BatchDataRef.current) {
      return "permit2";
    }
    if (!transaction.isConfirmed) {
      return "execute";
    }
    return "completed";
  })();

  // ── Reset ───────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    approvalToken0.transaction.reset();
    approvalToken1.transaction.reset();
    permit2Reset();
    transaction.reset();
  }, [approvalToken0.transaction, approvalToken1.transaction, permit2Reset, transaction]);

  // ── Return ──────────────────────────────────────────────────────────────
  return {
    steps: {
      approvalToken0,
      approvalToken1,
      permit2: permit2Step,
      execute: {
        transaction,
        execute,
      },
    },
    currentStep,
    executeAll,
    reset,
  };
}
