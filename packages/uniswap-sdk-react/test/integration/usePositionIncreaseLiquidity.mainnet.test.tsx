import { renderHook, waitFor } from "@testing-library/react";
import { parseUnits, zeroAddress } from "viem";
import { unichain } from "wagmi/chains";

import { usePositionIncreaseLiquidity } from "@/hooks/usePositionIncreaseLiquidity";
import { useUniswapSDK } from "@/hooks/useUniswapSDK";
import { findLivePositionTokenId } from "@/test/integration/findLivePosition";
import { pinSdkClientToBlock } from "@/test/integration/pinSdkClient";
import { createIntegrationWrapper } from "@/test/integration/renderHookWithProviders";

describe("usePositionIncreaseLiquidity (unichain rpc)", () => {
  it("loads a live position and reaches permit2 stage deterministically at pinned block", async () => {
    const { wrapper } = createIntegrationWrapper();
    const { result: sdkResult } = renderHook(() => useUniswapSDK({ chainId: unichain.id }), { wrapper });
    pinSdkClientToBlock(sdkResult.current.sdk);

    const tokenId = await findLivePositionTokenId(sdkResult.current.sdk);

    const { result } = renderHook(
      () =>
        usePositionIncreaseLiquidity(
          { tokenId },
          {
            chainId: unichain.id,
            amount0: parseUnits("0.001", 18),
            amount1: parseUnits("1", 6),
          },
        ),
      { wrapper },
    );

    await waitFor(() => {
      expect(["permit2", "execute"]).toContain(result.current.currentStep);
    });
  });

  it("fails execution without wallet while still using real pinned RPC data", async () => {
    const { wrapper } = createIntegrationWrapper();
    const { result: sdkResult } = renderHook(() => useUniswapSDK({ chainId: unichain.id }), { wrapper });
    pinSdkClientToBlock(sdkResult.current.sdk);

    const tokenId = await findLivePositionTokenId(sdkResult.current.sdk);

    const { result } = renderHook(
      () =>
        usePositionIncreaseLiquidity(
          { tokenId },
          {
            chainId: unichain.id,
            amount0: parseUnits("0.001", 18),
            amount1: parseUnits("1", 6),
          },
        ),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.currentStep).toBe("permit2");
    });

    await expect(
      result.current.steps.execute.execute({
        recipient: zeroAddress,
        amount0: parseUnits("0.001", 18),
      }),
    ).rejects.toBeInstanceOf(Error);
  });
});
