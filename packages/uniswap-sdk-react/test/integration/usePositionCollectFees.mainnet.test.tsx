import { act, renderHook, waitFor } from "@testing-library/react";
import { zeroAddress } from "viem";
import { unichain } from "wagmi/chains";

import { usePositionCollectFees } from "@/hooks/usePositionCollectFees";
import { usePosition } from "@/hooks/usePosition";
import { useUniswapSDK } from "@/hooks/useUniswapSDK";
import { findLivePositionTokenId } from "@/test/integration/findLivePosition";
import { pinSdkClientToBlock } from "@/test/integration/pinSdkClient";
import { createIntegrationWrapper } from "@/test/integration/renderHookWithProviders";

describe("usePositionCollectFees (unichain rpc)", () => {
  it("loads a live position at pinned block and execution rejects without wallet", async () => {
    const { wrapper } = createIntegrationWrapper();
    const { result: sdkResult } = renderHook(() => useUniswapSDK({ chainId: unichain.id }), { wrapper });
    pinSdkClientToBlock(sdkResult.current.sdk);

    const tokenId = await findLivePositionTokenId(sdkResult.current.sdk);

    const { result: positionResult } = renderHook(() => usePosition({ tokenId }, { chainId: unichain.id }), {
      wrapper,
    });

    await waitFor(() => {
      expect(positionResult.current.query.isSuccess).toBe(true);
    });

    const { result } = renderHook(() => usePositionCollectFees({ tokenId }, { chainId: unichain.id }), { wrapper });

    await act(async () => {
      await expect(
        result.current.execute({
          recipient: zeroAddress,
        }),
      ).rejects.toBeInstanceOf(Error);
    });
  });
});
