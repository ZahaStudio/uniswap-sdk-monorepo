import { useUniswapSDK } from "@/core/sdk";

export function useQuote() {
  const { data, status } = useUniswapSDK();

  return {};
}
