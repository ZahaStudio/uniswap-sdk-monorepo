"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

import { SWAP_ROUTE_DEFINITIONS } from "@/components/swap/routes";
import { SwapForm } from "@/components/swap/swap-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function SwapPage() {
  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Uniswap v4</Badge>
            <Badge variant="outline">SDK demo</Badge>
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Swap through `@zahastudio/uniswap-sdk-react`</h1>
            <p className="text-muted-foreground max-w-2xl">
              A focused UI for exercising `useSwap`: quote simulation, ERC-20 approval, Permit2 signing, and Universal
              Router execution.
            </p>
          </div>
        </div>
        <SwapForm />
      </div>
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Wallet</CardTitle>
            <CardDescription>RainbowKit is configured for Ethereum mainnet.</CardDescription>
          </CardHeader>
          <CardContent>
            <ConnectButton
              showBalance={true}
              accountStatus="full"
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Curated routes</CardTitle>
            <CardDescription>High-liquidity mainnet pairs represented as SDK `PoolKey` definitions.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {SWAP_ROUTE_DEFINITIONS.map((route) => (
              <div
                className="flex items-center justify-between gap-3"
                key={route.id}
              >
                <div className="flex min-w-0 flex-col">
                  <span className="font-medium">{route.label}</span>
                  <span className="text-muted-foreground truncate text-xs">{route.liquidityLabel}</span>
                </div>
                <Badge variant="outline">{route.feeLabel}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
