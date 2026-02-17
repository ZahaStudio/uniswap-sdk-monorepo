import { renderHook, waitFor } from "@testing-library/react";
import { unichain } from "wagmi/chains";

import { usePosition } from "@/hooks/usePosition";
import { useUniswapSDK } from "@/hooks/useUniswapSDK";
import { findLivePositionTokenId } from "@/test/integration/findLivePosition";
import { getSdkClient, pinSdkClientToBlock } from "@/test/integration/pinSdkClient";
import { createIntegrationWrapper } from "@/test/integration/renderHookWithProviders";

describe("usePosition (unichain rpc)", () => {
  it("returns deterministic position + fee data at the pinned block", async () => {
    const { wrapper } = createIntegrationWrapper();

    const { result: sdkResult } = renderHook(() => useUniswapSDK({ chainId: unichain.id }), { wrapper });
    pinSdkClientToBlock(sdkResult.current.sdk);

    const tokenId = await findLivePositionTokenId(sdkResult.current.sdk);
    const expectedPosition = await sdkResult.current.sdk.getPosition(tokenId);
    const expectedFees = await sdkResult.current.sdk.getUncollectedFees(tokenId);

    const { result } = renderHook(() => usePosition({ tokenId }, { chainId: unichain.id }), { wrapper });

    await waitFor(
      () => {
        expect(result.current.query.isSuccess).toBe(true);
      },
      { timeout: 10_000 },
    );

    expect(result.current.query.data?.position.liquidity.toString()).toBe(
      expectedPosition.position.liquidity.toString(),
    );
    expect(result.current.query.data?.position.tickLower).toBe(expectedPosition.position.tickLower);
    expect(result.current.query.data?.position.tickUpper).toBe(expectedPosition.position.tickUpper);
    expect(result.current.query.data?.pool.tickCurrent).toBe(expectedPosition.pool.tickCurrent);
    expect(result.current.query.data?.periphery.uncollectedFees.amount0.toString()).toBe(
      expectedFees.amount0.toString(),
    );
    expect(result.current.query.data?.periphery.uncollectedFees.amount1.toString()).toBe(
      expectedFees.amount1.toString(),
    );
  });

  it("stays idle when tokenId is empty", async () => {
    const { wrapper } = createIntegrationWrapper();
    const { result } = renderHook(() => usePosition({ tokenId: "" }, { chainId: unichain.id }), { wrapper });

    await waitFor(() => {
      expect(result.current.query.fetchStatus).toBe("idle");
    });
  });

  it("returns no-liquidity error without repeated retries", async () => {
    const { wrapper } = createIntegrationWrapper();

    const { result: sdkResult } = renderHook(() => useUniswapSDK({ chainId: unichain.id }), { wrapper });
    pinSdkClientToBlock(sdkResult.current.sdk);

    const client = getSdkClient(sdkResult.current.sdk);
    const originalReadContract = client.readContract;
    let positionInfoReads = 0;

    if (typeof originalReadContract === "function") {
      client.readContract = async (args: unknown) => {
        const fnName = (args as { functionName?: string }).functionName;
        if (fnName === "getPositionInfo") {
          positionInfoReads += 1;
        }

        return originalReadContract(args);
      };
    }

    try {
      const { result } = renderHook(() => usePosition({ tokenId: "0" }, { chainId: unichain.id }), { wrapper });

      await waitFor(() => {
        expect(result.current.query.isError).toBe(true);
      });

      expect(result.current.query.error?.message).toContain("Position has no liquidity");
      expect(positionInfoReads).toBeLessThanOrEqual(2);
    } finally {
      if (typeof originalReadContract === "function") {
        client.readContract = originalReadContract;
      }
    }
  });
});
