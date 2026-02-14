import type { UniswapSDKInstance } from "@/core/sdk";

export async function getDefaultDeadline(instance: UniswapSDKInstance, deadlineDuration?: number): Promise<bigint> {
  return (await instance.client.getBlock()).timestamp + BigInt(deadlineDuration ?? instance.defaultDeadline);
}
