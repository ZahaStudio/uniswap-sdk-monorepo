"use client";

import { AppLayout } from "@/components/app-layout";
import { PositionDemo } from "@/components/position-demo";

export const dynamic = "force-dynamic";

export default function PositionPage() {
  return (
    <AppLayout>
      <div className="mb-8 text-center">
        <h1 className="text-text mb-2 text-3xl font-bold tracking-tight">Position</h1>
        <p className="text-text-secondary text-sm">
          Uniswap V4 position management via{" "}
          <code className="bg-surface text-accent rounded px-1.5 py-0.5 font-mono text-xs">usePosition</code> hook
        </p>
      </div>
      <PositionDemo />
    </AppLayout>
  );
}
