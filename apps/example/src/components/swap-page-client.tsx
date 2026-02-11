"use client";

import { Header } from "@/components/header";
import { SwapDemo } from "@/components/swap-demo";

export function SwapPageClient() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Ambient background glow */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -left-40 -top-40 h-[600px] w-[600px] rounded-full bg-accent/[0.04] blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-accent/[0.03] blur-[100px]" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6">
        <Header />

        <main className="flex flex-1 flex-col items-center justify-center pb-16">
          <div className="mb-8 text-center">
            <h1 className="mb-2 text-3xl font-bold tracking-tight text-text">
              Swap
            </h1>
            <p className="text-sm text-text-secondary">
              Uniswap V4 swap via{" "}
              <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-xs text-accent">
                useSwap
              </code>{" "}
              hook
            </p>
          </div>

          <SwapDemo />
        </main>

        <footer className="flex items-center justify-center py-6 text-xs text-text-muted">
          <span>
            Built with{" "}
            <code className="font-mono text-text-secondary">
              @zahastudio/uniswap-sdk-react
            </code>
          </span>
        </footer>
      </div>
    </div>
  );
}
