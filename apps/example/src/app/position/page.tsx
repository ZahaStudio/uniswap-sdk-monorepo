"use client";

import dynamicImport from "next/dynamic";

import { AppLayout } from "@/components/app-layout";

const PositionDemo = dynamicImport(() => import("@/components/position-demo").then((mod) => mod.PositionDemo), {
  ssr: false,
});

export default function PositionPage() {
  return (
    <AppLayout>
      <div className="mb-8 text-center">
        <h1 className="mb-2 text-3xl font-bold tracking-tight text-text">Position</h1>
        <p className="text-sm text-text-secondary">
          Uniswap v4 position management via{" "}
          <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-xs text-accent">usePosition</code> hook
        </p>
      </div>
      <PositionDemo />
    </AppLayout>
  );
}
