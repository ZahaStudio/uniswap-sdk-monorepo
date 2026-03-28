import type { Address } from "viem";

export function assertWalletConnected(address: Address | undefined): asserts address is Address {
  if (!address) {
    throw new Error("No wallet connected. Ensure a wallet is connected before executing transactions.");
  }
}

export function assertSameAddress(expected: Address, actual: Address): void {
  if (expected.toLowerCase() !== actual.toLowerCase()) {
    throw new Error("The connected wallet must match the configured swapper address.");
  }
}
