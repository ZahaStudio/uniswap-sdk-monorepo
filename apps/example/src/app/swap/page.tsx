"use client";

import { AppLayout } from "@/components/app-layout";
import { SwapDemo } from "@/components/swap-demo";

export default function SwapPage() {
  return (
    <AppLayout>
      <div className="mb-8 text-center">
        <h1 className="text-text mb-2 text-3xl font-bold tracking-tight">Swap</h1>
        <p className="text-text-secondary text-sm">
          Uniswap V4 swap via{" "}
          <code className="bg-surface text-accent rounded px-1.5 py-0.5 font-mono text-xs">useSwap</code> hook
        </p>
      </div>
      <SwapDemo />
    </AppLayout>
  );
}
