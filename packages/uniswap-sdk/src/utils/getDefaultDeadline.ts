import { DEFAULT_DEADLINE } from "@/constants/common";
import type { UniswapSDKInstance } from "@/types";

export async function getDefaultDeadline(
  instance: UniswapSDKInstance,
  timeFromNow: number = DEFAULT_DEADLINE,
): Promise<bigint> {
  return (await instance.client.getBlock()).timestamp + BigInt(timeFromNow);
}
