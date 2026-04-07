"use client";

import { AppLayout } from "@/components/app-layout";
import { TradingDemo } from "@/components/trading-demo";

const tradingApiKey = process.env.NEXT_PUBLIC_UNISWAP_API_KEY;

function MissingApiKeyState() {
  return (
    <div className="border-border-muted bg-surface w-full max-w-2xl rounded-2xl border p-8">
      <div className="text-warning mb-2 text-sm font-semibold">Trading SDK not configured</div>
      <p className="text-text-secondary text-sm leading-6">
        Set{" "}
        <code className="bg-surface-raised rounded px-1.5 py-0.5 font-mono text-xs">NEXT_PUBLIC_UNISWAP_API_KEY</code>{" "}
        in <code className="bg-surface-raised rounded px-1.5 py-0.5 font-mono text-xs">apps/example/.env.local</code> to
        enable the Trading API demo page.
      </p>
    </div>
  );
}

export default function TradingPage() {
  return (
    <AppLayout>
      <div className="mb-8 text-center">
        <h1 className="text-text mb-2 text-3xl font-bold tracking-tight">Trading SDK</h1>
        <p className="text-text-secondary text-sm">
          Uniswap Trading API flow via{" "}
          <code className="bg-surface text-accent rounded px-1.5 py-0.5 font-mono text-xs">useTrading</code>
        </p>
      </div>

      {tradingApiKey ? <TradingDemo /> : <MissingApiKeyState />}
    </AppLayout>
  );
}
