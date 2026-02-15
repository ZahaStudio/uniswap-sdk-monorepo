"use client";

import { useCallback, useState } from "react";

import { type PreparePermit2BatchDataResult } from "@zahastudio/uniswap-sdk";
import type { Address } from "viem";
import { zeroAddress } from "viem";
import { useAccount, useSignTypedData } from "wagmi";

import { useTokenApproval, type UseTokenApprovalReturn } from "@/hooks/primitives/useTokenApproval";
import { useUniswapSDK } from "@/hooks/useUniswapSDK";
import { assertSdkInitialized, assertWalletConnected } from "@/utils/assertions";

/**
 * A token to include in the Permit2 flow.
 * Native tokens (zeroAddress) are automatically skipped for approval and signing.
 */
export interface UsePermit2Token {
  /** ERC-20 token address (use zeroAddress for native ETH) */
  address: Address;
  /** Required amount — used for ERC-20 → Permit2 allowance checking */
  amount: bigint;
}

/**
 * Parameters for the usePermit2 hook.
 */
export interface UsePermit2Params {
  /**
   * Tokens to approve and sign permits for (1 or 2).
   * Native tokens are automatically excluded from approval/signing.
   */
  tokens: [UsePermit2Token] | [UsePermit2Token, UsePermit2Token];
  /** Address that will spend the tokens via Permit2 (e.g. universalRouter, positionManager) */
  spender: Address;
}

/**
 * Configuration options for the usePermit2 hook.
 */
export interface UsePermit2Options {
  /** Whether the hook is enabled (default: true) */
  enabled?: boolean;
  /** Override chain ID */
  chainId?: number;
}

/**
 * Discriminated union for the signed Permit2 data.
 * Consumers can narrow on `kind` to get the correctly-typed data.
 */
export type Permit2SignedResult =
  | { kind: "none" }
  | { kind: "batch"; data: ReturnType<PreparePermit2BatchDataResult["buildPermit2BatchDataWithSignature"]> };

/**
 * Permit2 signing step state.
 */
export interface UsePermit2SignStep {
  /** Whether permit2 signing is required (false when all tokens are native or no tokens) */
  isRequired: boolean;
  /** Whether the wallet signature prompt is pending */
  isPending: boolean;
  /** Whether the permit2 has been signed */
  isSigned: boolean;
  /** Error from the signing step */
  error: Error | undefined;
  /** The mode that will be used for signing */
  kind: Permit2SignedResult["kind"];
  /** The signed result (present when isSigned is true, or kind is "none") */
  signed: Permit2SignedResult | undefined;
  /** Initiate permit2 preparation and signing */
  sign: () => Promise<Permit2SignedResult>;
  /** Reset the permit2 signing state */
  reset: () => void;
}

/**
 * Current step in the Permit2 lifecycle.
 */
export type Permit2Step = "approval0" | "approval1" | "permit2" | "ready";

/**
 * Return type for the usePermit2 hook.
 */
export interface UsePermit2Return {
  /** ERC-20 → Permit2 approval states (always a 2-tuple; unused slots are no-ops) */
  approvals: [UseTokenApprovalReturn, UseTokenApprovalReturn];
  /** Off-chain Permit2 signature step */
  permit2: UsePermit2SignStep;
  /** The first incomplete required step */
  currentStep: Permit2Step;
  /** Execute all remaining required steps (approvals + signing) sequentially */
  approveAndSign: () => Promise<Permit2SignedResult>;
  /** Reset all mutation state (approvals + permit2 signing) */
  reset: () => void;
}

interface KeyedState<T> {
  key: string;
  value: T;
}

const EMPTY_TOKEN: UsePermit2Token = { address: zeroAddress, amount: 0n };

function isNonNative(token: UsePermit2Token): boolean {
  return token.address.toLowerCase() !== zeroAddress.toLowerCase() && token.amount > 0n;
}

function createPermit2InputsKey(
  chainId: number,
  connectedAddress: Address,
  spender: Address,
  token0: UsePermit2Token,
  token1: UsePermit2Token,
): string {
  return `${chainId}-${connectedAddress}-${spender}-${token0.address}-${token0.amount}-${token1.address}-${token1.amount}`;
}

/**
 * Reusable hook that manages the full Permit2 lifecycle:
 * ERC-20 approval(s) to the Permit2 contract, then off-chain Permit2 batch signing.
 *
 * Always uses batch permit2 signing regardless of token count.
 * Automatically detects whether signing is needed based on the number of non-native
 * tokens provided. Native tokens (zeroAddress) are skipped entirely.
 *
 * @param params - Tokens and spender address
 * @param options - Configuration: enabled, chainId
 * @returns Approval states, permit2 sign step, current step, and executeAll
 *
 * @example Single-token (swap)
 * ```tsx
 * const permit2 = usePermit2({
 *   tokens: [{ address: tokenIn, amount: amountIn }],
 *   spender: universalRouter,
 * });
 *
 * const signed = await permit2.approveAndSign();
 * if (signed.kind === "batch") {
 *   sdk.buildSwapCallData({ permit2Signature: signed.data });
 * }
 * ```
 *
 * @example Multi-token (liquidity)
 * ```tsx
 * const permit2 = usePermit2({
 *   tokens: [
 *     { address: token0, amount: amount0 },
 *     { address: token1, amount: amount1 },
 *   ],
 *   spender: positionManager,
 * });
 *
 * const signed = await permit2.approveAndSign();
 * if (signed.kind === "batch") {
 *   sdk.buildAddLiquidityCallData({ permit2BatchSignature: signed.data });
 * }
 * ```
 */
export function usePermit2(params: UsePermit2Params, options: UsePermit2Options = {}): UsePermit2Return {
  const { tokens, spender } = params;
  const { enabled = true, chainId: chainIdOverride } = options;

  const { sdk, chainId } = useUniswapSDK({ chainId: chainIdOverride });
  const { address: connectedAddress } = useAccount();

  const token0 = tokens[0] ?? EMPTY_TOKEN;
  const token1 = tokens[1] ?? EMPTY_TOKEN;

  const token0IsRelevant = isNonNative(token0);
  const token1IsRelevant = isNonNative(token1);

  const relevantCount = (token0IsRelevant ? 1 : 0) + (token1IsRelevant ? 1 : 0);
  const signingKind: Permit2SignedResult["kind"] = relevantCount === 0 ? "none" : "batch";

  console.log({ relevantCount, signingKind });

  const permit2Address = sdk.getContractAddress("permit2") ?? zeroAddress;

  const approval0 = useTokenApproval(
    {
      token: token0.address,
      spender: permit2Address,
      amount: token0.amount,
    },
    {
      enabled: enabled && token0IsRelevant,
      chainId,
    },
  );

  const approval1 = useTokenApproval(
    {
      token: token1.address,
      spender: permit2Address,
      amount: token1.amount,
    },
    {
      enabled: enabled && token1IsRelevant,
      chainId,
    },
  );

  const signTypedData = useSignTypedData();

  const [signedState, setSignedState] = useState<KeyedState<Permit2SignedResult> | undefined>(undefined);
  const [signErrorState, setSignErrorState] = useState<KeyedState<Error> | undefined>(undefined);

  const inputsKey = createPermit2InputsKey(chainId, connectedAddress ?? zeroAddress, spender, token0, token1);
  const signed = signedState?.key === inputsKey ? signedState.value : undefined;
  const signError = signErrorState?.key === inputsKey ? signErrorState.value : undefined;

  const permit2Sign = useCallback(async (): Promise<Permit2SignedResult> => {
    if (signingKind === "none") {
      const result: Permit2SignedResult = { kind: "none" };
      setSignedState({ key: inputsKey, value: result });
      return result;
    }

    assertWalletConnected(connectedAddress);
    assertSdkInitialized(sdk);

    try {
      setSignErrorState(undefined);

      const batchTokens: Address[] = [];
      if (token0IsRelevant) batchTokens.push(token0.address);
      if (token1IsRelevant) batchTokens.push(token1.address);

      const prepareResult = await sdk.preparePermit2BatchData({
        tokens: batchTokens,
        spender,
        owner: connectedAddress,
      });

      const signature = await signTypedData.signTypedDataAsync({
        domain: prepareResult.toSign.domain,
        types: prepareResult.toSign.types,
        primaryType: prepareResult.toSign.primaryType,
        message: prepareResult.toSign.message,
      });

      const result: Permit2SignedResult = {
        kind: "batch",
        data: prepareResult.buildPermit2BatchDataWithSignature(signature),
      };
      setSignedState({ key: inputsKey, value: result });
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setSignErrorState({ key: inputsKey, value: error });
      throw error;
    }
  }, [
    signingKind,
    connectedAddress,
    sdk,
    spender,
    inputsKey,
    token0IsRelevant,
    token1IsRelevant,
    token0.address,
    token1.address,
    signTypedData,
  ]);

  const permit2Reset = useCallback(() => {
    setSignedState(undefined);
    setSignErrorState(undefined);
    signTypedData.reset();
  }, [signTypedData]);

  const permit2Step: UsePermit2SignStep = {
    isRequired: signingKind !== "none",
    isPending: signTypedData.isPending,
    isSigned: !!signed,
    error: signError,
    kind: signingKind,
    signed,
    sign: permit2Sign,
    reset: permit2Reset,
  };

  const currentStep: Permit2Step = (() => {
    if (token0IsRelevant && (approval0.isRequired === undefined || approval0.isRequired)) {
      return "approval0";
    }
    if (token1IsRelevant && (approval1.isRequired === undefined || approval1.isRequired)) {
      return "approval1";
    }
    if (permit2Step.isRequired && !signed) {
      return "permit2";
    }
    return "ready";
  })();

  const approveAndSign = useCallback(async (): Promise<Permit2SignedResult> => {
    if (token0IsRelevant && approval0.isRequired && approval0.transaction.status !== "confirmed") {
      if (approval0.isRequired === undefined) {
        throw new Error("Awaiting approval status for token0");
      }
      await approval0.approve();
      await approval0.transaction.waitForConfirmation();
    }

    if (token1IsRelevant && approval1.isRequired && approval1.transaction.status !== "confirmed") {
      if (approval1.isRequired === undefined) {
        throw new Error("Awaiting approval status for token1");
      }
      await approval1.approve();
      await approval1.transaction.waitForConfirmation();
    }

    if (signed) {
      console.log({ signed });
      return signed;
    }

    return permit2Sign();
  }, [token0IsRelevant, token1IsRelevant, approval0, approval1, signed, permit2Sign]);

  const reset = useCallback(() => {
    approval0.transaction.reset();
    approval1.transaction.reset();
    permit2Reset();
  }, [approval0.transaction, approval1.transaction, permit2Reset]);

  return {
    approvals: [approval0, approval1],
    permit2: permit2Step,
    currentStep,
    approveAndSign,
    reset,
  };
}
