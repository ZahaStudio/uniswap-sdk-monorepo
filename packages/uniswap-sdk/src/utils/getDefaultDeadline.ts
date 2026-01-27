import { DEFAULT_DEADLINE } from "@/constants/common";
import type { UniDevKitV4Instance } from "@/types";

export async function getDefaultDeadline(
  instance: UniDevKitV4Instance,
  timeFromNow: number = DEFAULT_DEADLINE,
): Promise<bigint> {
  return (await instance.client.getBlock()).timestamp + BigInt(timeFromNow);
}
