"use client";

import { AppLayout } from "@/components/app-layout";
import dynamicImport from "next/dynamic";

export const dynamic = "force-dynamic";

const CreatePositionDemo = dynamicImport(
  () => import("@/components/create-position-demo").then((mod) => mod.CreatePositionDemo),
  { ssr: false },
);

export default function CreatePositionPage() {
  return (
    <AppLayout>
      <div className="mb-8 text-center">
        <h1 className="mb-2 text-3xl font-bold tracking-tight text-text">Create Position</h1>
        <p className="text-sm text-text-secondary">
          Mint a new Uniswap v4 position via{" "}
          <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-xs text-accent">useCreatePosition</code> hook
        </p>
      </div>
      <CreatePositionDemo />
    </AppLayout>
  );
}
