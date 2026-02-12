import { DEFAULT_DEADLINE } from "@/common/constants";
import type { UniswapSDKInstance } from "@/core/sdk";

export async function getDefaultDeadline(
  instance: UniswapSDKInstance,
  timeFromNow: number = DEFAULT_DEADLINE,
): Promise<bigint> {
  return (await instance.client.getBlock()).timestamp + BigInt(timeFromNow);
}
