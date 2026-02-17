import { renderHook, waitFor } from "@testing-library/react";
import { Position, TickMath, nearestUsableTick } from "@zahastudio/uniswap-sdk";
import { parseUnits, zeroAddress } from "viem";
import { unichain } from "wagmi/chains";

import { useCreatePosition } from "@/hooks/useCreatePosition";
import { useUniswapSDK } from "@/hooks/useUniswapSDK";
import { UNICHAIN_POOL_KEY } from "@/test/fixtures/unichain";
import { pinSdkClientToBlock } from "@/test/integration/pinSdkClient";
import { createIntegrationWrapper } from "@/test/integration/renderHookWithProviders";

describe("useCreatePosition (unichain rpc)", () => {
  it("derives deterministic pool and amount1 from amount0 at the pinned block", async () => {
    const { wrapper } = createIntegrationWrapper();

    const { result: sdkResult } = renderHook(() => useUniswapSDK({ chainId: unichain.id }), { wrapper });
    pinSdkClientToBlock(sdkResult.current.sdk);

    const amount0 = parseUnits("0.001", 18);

    const { result } = renderHook(
      () => useCreatePosition({ poolKey: UNICHAIN_POOL_KEY, amount0 }, { chainId: unichain.id }),
      { wrapper },
    );

    await waitFor(
      () => {
        expect(result.current.pool.isSuccess).toBe(true);
        expect(result.current.tickRange).not.toBeNull();
        expect(result.current.position).not.toBeNull();
      },
      { timeout: 10_000 },
    );

    const pool = result.current.pool.data!;
    const expectedTickLower = nearestUsableTick(TickMath.MIN_TICK, pool.tickSpacing);
    const expectedTickUpper = nearestUsableTick(TickMath.MAX_TICK, pool.tickSpacing);

    expect(result.current.tickRange).toEqual({
      tickLower: expectedTickLower,
      tickUpper: expectedTickUpper,
    });

    const expectedPosition = Position.fromAmount0({
      pool,
      tickLower: expectedTickLower,
      tickUpper: expectedTickUpper,
      amount0: amount0.toString(),
      useFullPrecision: true,
    });

    expect(result.current.position?.amount0.toString()).toBe(expectedPosition.amount0.quotient.toString());
    expect(result.current.position?.amount1.toString()).toBe(expectedPosition.amount1.quotient.toString());
    expect(result.current.position?.formattedAmount1).toBe(expectedPosition.amount1.toExact());
    expect(result.current.currentStep).toBe("permit2");
  });

  it("derives deterministic amount0 from amount1 at the pinned block", async () => {
    const { wrapper } = createIntegrationWrapper();

    const { result: sdkResult } = renderHook(() => useUniswapSDK({ chainId: unichain.id }), { wrapper });
    pinSdkClientToBlock(sdkResult.current.sdk);

    const amount1 = parseUnits("1", 6);

    const { result } = renderHook(
      () => useCreatePosition({ poolKey: UNICHAIN_POOL_KEY, amount1 }, { chainId: unichain.id }),
      { wrapper },
    );

    await waitFor(
      () => {
        expect(result.current.pool.isSuccess).toBe(true);
        expect(result.current.tickRange).not.toBeNull();
        expect(result.current.position).not.toBeNull();
      },
      { timeout: 10_000 },
    );

    const pool = result.current.pool.data!;
    const tickRange = result.current.tickRange!;

    const expectedPosition = Position.fromAmount1({
      pool,
      tickLower: tickRange.tickLower,
      tickUpper: tickRange.tickUpper,
      amount1: amount1.toString(),
    });

    expect(result.current.position?.amount0.toString()).toBe(expectedPosition.amount0.quotient.toString());
    expect(result.current.position?.amount1.toString()).toBe(expectedPosition.amount1.quotient.toString());
  });

  it("builds and sends add-liquidity calldata with pinned pool state", async () => {
    const { wrapper } = createIntegrationWrapper();

    const { result: sdkResult } = renderHook(() => useUniswapSDK({ chainId: unichain.id }), { wrapper });
    pinSdkClientToBlock(sdkResult.current.sdk);

    const { result } = renderHook(
      () =>
        useCreatePosition({ poolKey: UNICHAIN_POOL_KEY, amount0: parseUnits("0.001", 18) }, { chainId: unichain.id }),
      { wrapper },
    );

    await waitFor(
      () => {
        expect(result.current.pool.isSuccess).toBe(true);
        expect(result.current.currentStep).toBe("permit2");
      },
      { timeout: 10_000 },
    );

    await expect(
      result.current.steps.execute.execute({
        recipient: zeroAddress,
      }),
    ).rejects.toBeInstanceOf(Error);
  });
});
