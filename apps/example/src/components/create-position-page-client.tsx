"use client";

import { AppLayout } from "@/components/app-layout";
import { CreatePositionDemo } from "@/components/create-position-demo";

export function CreatePositionPageClient() {
  return (
    <AppLayout>
      <div className="mb-8 text-center">
        <h1 className="text-text mb-2 text-3xl font-bold tracking-tight">Create Position</h1>
        <p className="text-text-secondary text-sm">
          Mint a new Uniswap V4 position via{" "}
          <code className="bg-surface text-accent rounded px-1.5 py-0.5 font-mono text-xs">useCreatePosition</code> hook
        </p>
      </div>
      <CreatePositionDemo />
    </AppLayout>
  );
}
