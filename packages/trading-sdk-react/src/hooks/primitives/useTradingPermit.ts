"use client";

import { useCallback, useMemo, useState } from "react";

import type { TradingPermitData } from "@zahastudio/trading-sdk";
import type { Address, Hex } from "viem";
import { zeroAddress } from "viem";
import { useSignTypedData } from "wagmi";

import { assertConnectedSwapper } from "@/utils";

interface KeyedState<T> {
  key: string;
  value: T;
}

export interface UseTradingPermitParams {
  chainId: number;
  tokenIn: Address;
  tokenOut: Address;
  amountIn: bigint;
  swapper?: Address;
  connectedAddress?: Address;
  permit2Disabled: boolean;
  permitData?: TradingPermitData | null;
  requestId?: string;
}

export interface UseTradingPermitStep {
  isRequired: boolean;
  isPending: boolean;
  isSigned: boolean;
  error: Error | undefined;
  signature: Hex | undefined;
  sign: () => Promise<Hex | undefined>;
  reset: () => void;
}

function createPermitKey(params: {
  chainId: number;
  tokenIn: Address;
  tokenOut: Address;
  amountIn: bigint;
  swapper?: Address;
  permit2Disabled: boolean;
  requestId?: string;
}): string {
  return [
    params.chainId,
    params.tokenIn,
    params.tokenOut,
    params.amountIn.toString(),
    params.swapper ?? zeroAddress,
    params.permit2Disabled,
    params.requestId ?? "",
  ].join(":");
}

function getPrimaryType(types: TradingPermitData["types"]): string {
  const primaryTypes = Object.keys(types).filter((typeName) => typeName !== "EIP712Domain");
  if (primaryTypes.length !== 1) {
    throw new Error("Unable to determine Permit2 primary type from Trading API response.");
  }

  return primaryTypes[0]!;
}

export function useTradingPermit({
  chainId,
  tokenIn,
  tokenOut,
  amountIn,
  swapper,
  connectedAddress,
  permit2Disabled,
  permitData,
  requestId,
}: UseTradingPermitParams): UseTradingPermitStep {
  const signTypedData = useSignTypedData();

  const permitKey = useMemo(
    () =>
      createPermitKey({
        chainId,
        tokenIn,
        tokenOut,
        amountIn,
        swapper,
        permit2Disabled,
        requestId,
      }),
    [amountIn, chainId, permit2Disabled, requestId, swapper, tokenIn, tokenOut],
  );

  const [signatureState, setSignatureState] = useState<KeyedState<Hex | undefined> | undefined>(undefined);
  const [permitErrorState, setPermitErrorState] = useState<KeyedState<Error> | undefined>(undefined);
  const [pendingPermitKey, setPendingPermitKey] = useState<string | undefined>(undefined);

  const isRequired = !permit2Disabled && !!permitData;
  const signature = signatureState?.key === permitKey ? signatureState.value : undefined;
  const error = permitErrorState?.key === permitKey ? permitErrorState.value : undefined;

  const sign = useCallback(async (): Promise<Hex | undefined> => {
    if (!isRequired) {
      setSignatureState({ key: permitKey, value: undefined });
      return undefined;
    }

    if (!permitData) {
      throw new Error("Permit data not available.");
    }

    assertConnectedSwapper(swapper, connectedAddress);

    try {
      setPermitErrorState(undefined);
      setPendingPermitKey(permitKey);

      const nextSignature = await signTypedData.signTypedDataAsync({
        domain: permitData.domain,
        types: permitData.types,
        primaryType: getPrimaryType(permitData.types),
        message: permitData.values,
      });

      setSignatureState({ key: permitKey, value: nextSignature });
      setPendingPermitKey(undefined);

      return nextSignature;
    } catch (cause) {
      const normalized = cause instanceof Error ? cause : new Error(String(cause));
      setPermitErrorState({ key: permitKey, value: normalized });
      setPendingPermitKey(undefined);
      throw normalized;
    }
  }, [connectedAddress, isRequired, permitData, permitKey, signTypedData, swapper]);

  const reset = useCallback(() => {
    setSignatureState(undefined);
    setPermitErrorState(undefined);
    setPendingPermitKey(undefined);
  }, []);

  return {
    isRequired,
    isPending: pendingPermitKey === permitKey,
    isSigned: !!signature,
    error,
    signature,
    sign,
    reset,
  };
}
