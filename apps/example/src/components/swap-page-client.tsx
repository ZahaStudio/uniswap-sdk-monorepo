"use client";

import { Header } from "@/components/header";
import { SwapDemo } from "@/components/swap-demo";

export function SwapPageClient() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Ambient background glow */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="bg-accent/4 absolute -top-40 -left-40 h-150 w-150 rounded-full blur-[120px]" />
        <div className="bg-accent/3 absolute -right-40 -bottom-40 h-125 w-125 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6">
        <Header />

        <main className="flex flex-1 flex-col items-center justify-center pb-16">
          <div className="mb-8 text-center">
            <h1 className="text-text mb-2 text-3xl font-bold tracking-tight">Swap</h1>
            <p className="text-text-secondary text-sm">
              Uniswap V4 swap via{" "}
              <code className="bg-surface text-accent rounded px-1.5 py-0.5 font-mono text-xs">useSwap</code> hook
            </p>
          </div>

          <SwapDemo />
        </main>

        <footer className="text-text-muted flex items-center justify-center py-6 text-xs">
          <span>
            Built with <code className="text-text-secondary font-mono">@zahastudio/uniswap-sdk-react</code>
          </span>
        </footer>
      </div>
    </div>
  );
}
