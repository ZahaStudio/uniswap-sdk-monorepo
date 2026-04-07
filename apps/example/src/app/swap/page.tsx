"use client";

import { AppLayout } from "@/components/app-layout";
import { SwapDemo } from "@/components/swap-demo";

export default function SwapPage() {
  return (
    <AppLayout>
      <div className="mb-8 text-center">
        <h1 className="mb-2 text-3xl font-bold tracking-tight text-text">Swap</h1>
        <p className="text-sm text-text-secondary">
          Uniswap V4 swap via{" "}
          <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-xs text-accent">useSwap</code> hook
        </p>
      </div>
      <SwapDemo />
    </AppLayout>
  );
}
