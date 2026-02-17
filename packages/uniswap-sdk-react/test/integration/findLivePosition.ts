import type { UniswapSDK } from "@zahastudio/uniswap-sdk";

export async function findLivePositionTokenId(sdk: UniswapSDK): Promise<string> {
  for (let tokenId = 1; tokenId <= 250; tokenId += 1) {
    try {
      const position = await sdk.getPosition(String(tokenId));
      if (BigInt(position.position.liquidity.toString()) > 0n) {
        return String(tokenId);
      }
    } catch {}
  }

  throw new Error("Unable to find a live position tokenId in [1..250] at pinned block.");
}
