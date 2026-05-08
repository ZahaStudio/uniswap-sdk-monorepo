import type { Call, Capabilities, ExtractCapabilities } from "viem";

import { toHex } from "viem";

export type WalletCapabilities = Capabilities;

type AtomicCapability = NonNullable<ExtractCapabilities<"getCapabilities", "ReturnType">["atomic"]>;

/** Call shape used by viem/wagmi wallet call actions. */
export type WalletBatchCall = Pick<Call, "to" | "data" | "value">;

function getAtomicCapability(capabilities: unknown, chainId: number): AtomicCapability | undefined {
  if (!isRecord(capabilities)) {
    return undefined;
  }

  const direct = capabilities.atomic;
  if (isAtomicCapability(direct)) {
    return direct;
  }

  const chainCapabilities = capabilities[toHex(chainId)] ?? capabilities[String(chainId)];
  if (isRecord(chainCapabilities) && isAtomicCapability(chainCapabilities.atomic)) {
    return chainCapabilities.atomic;
  }

  const globalCapabilities = capabilities["0x0"];
  if (isRecord(globalCapabilities) && isAtomicCapability(globalCapabilities.atomic)) {
    return globalCapabilities.atomic;
  }

  return undefined;
}

export function isAtomicBatchSupported(capabilities: unknown, chainId: number): boolean {
  const atomic = getAtomicCapability(capabilities, chainId);
  return atomic?.status === "supported" || atomic?.status === "ready";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isAtomicCapability(value: unknown): value is AtomicCapability {
  if (!isRecord(value)) {
    return false;
  }
  return value.status === "supported" || value.status === "ready" || value.status === "unsupported";
}
