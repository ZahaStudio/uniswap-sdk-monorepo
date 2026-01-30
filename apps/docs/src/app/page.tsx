"use client";

import { usePermit2, usePosition, useQuote, useTokens } from "@zahastudio/uniswap-sdk-react";

const samplePoolKey = {
  currency0: "0xA0b86991C6218b36c1d19d4a2e9Eb0cE3606eB48",
  currency1: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  fee: 500,
  tickSpacing: 10,
  hooks: "0x0000000000000000000000000000000000000000",
} as const;

const sampleTokenArgs = {
  addresses: [samplePoolKey.currency0, samplePoolKey.currency1],
} as const;

const sampleQuoteArgs = {
  poolKey: samplePoolKey,
  zeroForOne: true,
  amountIn: "1000000",
  hookData: "0x",
} as const;

const samplePermit2Args = {
  token: samplePoolKey.currency0,
  spender: "0x0000000000000000000000000000000000000000",
  owner: "0x0000000000000000000000000000000000000000",
} as const;

function HookExamples() {
  const quote = useQuote(sampleQuoteArgs);
  const tokens = useTokens(sampleTokenArgs);
  const position = usePosition("1");
  const permit2 = usePermit2(samplePermit2Args, { enabled: false });

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div>Quote status: {quote.status}</div>
      <div>Tokens status: {tokens.status}</div>
      <div>Position status: {position.status}</div>
      <div>Permit2 status: {permit2.status}</div>
    </div>
  );
}

export default function Page() {
  return <HookExamples />;
}
