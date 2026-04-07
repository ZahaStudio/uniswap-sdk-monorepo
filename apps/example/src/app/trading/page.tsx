"use client";

import { AppLayout } from "@/components/app-layout";
import { TradingDemo } from "@/components/trading-demo";

const tradingApiKey = process.env.NEXT_PUBLIC_UNISWAP_API_KEY;

function MissingApiKeyState() {
  return (
    <div className="w-full max-w-2xl rounded-2xl border border-border-muted bg-surface p-8">
      <div className="mb-2 text-sm font-semibold text-warning">Trading SDK not configured</div>
      <p className="text-sm leading-6 text-text-secondary">
        Set{" "}
        <code className="rounded bg-surface-raised px-1.5 py-0.5 font-mono text-xs">NEXT_PUBLIC_UNISWAP_API_KEY</code>{" "}
        in <code className="rounded bg-surface-raised px-1.5 py-0.5 font-mono text-xs">apps/example/.env.local</code> to
        enable the Trading API demo page.
      </p>
    </div>
  );
}

export default function TradingPage() {
  return (
    <AppLayout>
      <div className="mb-8 text-center">
        <h1 className="mb-2 text-3xl font-bold tracking-tight text-text">Trading SDK</h1>
        <p className="text-sm text-text-secondary">
          Uniswap Trading API flow via{" "}
          <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-xs text-accent">useTrading</code>
        </p>
      </div>

      {tradingApiKey ? <TradingDemo /> : <MissingApiKeyState />}
    </AppLayout>
  );
}
