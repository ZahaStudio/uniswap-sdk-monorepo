import type { UniswapSDK } from "@zahastudio/uniswap-sdk";
import type { Address } from "viem";

/**
 * Assert that the SDK instance is initialized.
 * Throws a consistent error when the SDK is null/undefined (e.g. provider not mounted).
 */
export function assertSdkInitialized(sdk: UniswapSDK | null | undefined): asserts sdk is UniswapSDK {
  if (!sdk) {
    throw new Error("SDK not initialized. Ensure <UniswapProvider> is mounted and configured.");
  }
}

/**
 * Assert that a wallet is connected.
 * Throws a consistent error when the connected address is undefined.
 */
export function assertWalletConnected(address: Address | undefined): asserts address is Address {
  if (!address) {
    throw new Error("No wallet connected. Ensure a wallet is connected before executing transactions.");
  }
}
