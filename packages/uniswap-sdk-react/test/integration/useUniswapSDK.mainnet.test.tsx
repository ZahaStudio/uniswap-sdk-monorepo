import { renderHook } from "@testing-library/react";
import { zeroAddress } from "viem";
import { unichain } from "wagmi/chains";

import { useUniswapSDK } from "@/hooks/useUniswapSDK";
import { UNICHAIN_EXPECTED_POOL, UNICHAIN_POOL_KEY } from "@/test/fixtures/unichain";
import { pinSdkClientToBlock } from "@/test/integration/pinSdkClient";
import { createIntegrationWrapper } from "@/test/integration/renderHookWithProviders";

describe("useUniswapSDK (unichain rpc)", () => {
  it("initializes and returns cached SDK instances", () => {
    const { wrapper } = createIntegrationWrapper();

    const first = renderHook(() => useUniswapSDK({ chainId: unichain.id }), { wrapper });
    pinSdkClientToBlock(first.result.current.sdk);

    const second = renderHook(() => useUniswapSDK({ chainId: unichain.id }), { wrapper });

    expect(first.result.current.isInitialized).toBe(true);
    expect(first.result.current.chainId).toBe(unichain.id);
    expect(second.result.current.sdk).toBe(first.result.current.sdk);
  });

  it("reads pool data at the pinned block through the SDK instance", async () => {
    const { wrapper } = createIntegrationWrapper();
    const { result } = renderHook(() => useUniswapSDK({ chainId: unichain.id }), { wrapper });
    pinSdkClientToBlock(result.current.sdk);

    const pool = await result.current.sdk.getPool(UNICHAIN_POOL_KEY);

    expect(pool.fee).toBe(UNICHAIN_POOL_KEY.fee);
    expect(pool.tickSpacing).toBe(UNICHAIN_POOL_KEY.tickSpacing);

    const poolCurrency0Address = pool.currency0.isNative ? zeroAddress : pool.currency0.address;
    const poolCurrency1Address = pool.currency1.isNative ? zeroAddress : pool.currency1.address;

    expect(poolCurrency0Address.toLowerCase()).toBe(UNICHAIN_POOL_KEY.currency0.toLowerCase());
    expect(poolCurrency1Address.toLowerCase()).toBe(UNICHAIN_POOL_KEY.currency1.toLowerCase());
    expect(pool.liquidity.toString()).toBe(UNICHAIN_EXPECTED_POOL.liquidity);
    expect(pool.sqrtRatioX96.toString()).toBe(UNICHAIN_EXPECTED_POOL.sqrtRatioX96);
    expect(pool.tickCurrent).toBe(UNICHAIN_EXPECTED_POOL.tickCurrent);
  });
});
