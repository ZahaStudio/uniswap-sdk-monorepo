import type { QuoteData } from "@zahastudio/uniswap-sdk-react";

import type { SwapMode, SwapRouteDefinition, SwapToken } from "@/components/swap/types";

import { formatBps, formatQuoteTimestamp, formatTokenAmount } from "@/components/swap/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

export function QuoteDetails({
  mode,
  quote,
  isLoading,
  inputToken,
  outputToken,
  routeDefinition,
  slippageBps,
}: {
  mode: SwapMode;
  quote: QuoteData | undefined;
  isLoading: boolean;
  inputToken: SwapToken;
  outputToken: SwapToken;
  routeDefinition: SwapRouteDefinition | undefined;
  slippageBps: number;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>SDK quote</CardTitle>
        <CardDescription>Returned by `useSwap().steps.quote`.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {isLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-10/12" />
            <Skeleton className="h-4 w-8/12" />
          </div>
        ) : quote ? (
          <>
            <QuoteRow
              label={mode === "exactInput" ? "Expected output" : "Expected input"}
              value={
                mode === "exactInput"
                  ? `${formatTokenAmount(quote.amountOut, outputToken.decimals)} ${outputToken.symbol}`
                  : `${formatTokenAmount(quote.amountIn, inputToken.decimals)} ${inputToken.symbol}`
              }
            />
            <QuoteRow
              label={mode === "exactInput" ? "Minimum received" : "Maximum input"}
              value={
                "minAmountOut" in quote
                  ? `${formatTokenAmount(quote.minAmountOut, outputToken.decimals)} ${outputToken.symbol}`
                  : `${formatTokenAmount(quote.maxAmountIn, inputToken.decimals)} ${inputToken.symbol}`
              }
            />
            <Separator />
            <QuoteRow
              label="Route"
              value={routeDefinition?.label ?? "Unsupported"}
            />
            <QuoteRow
              label="Pool fee"
              value={routeDefinition?.feeLabel ?? "Unavailable"}
            />
            <QuoteRow
              label="Slippage"
              value={formatBps(slippageBps)}
            />
            <QuoteRow
              label="Quoted"
              value={formatQuoteTimestamp(quote.timestamp)}
            />
          </>
        ) : (
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">Status</span>
            <Badge variant="outline">Waiting for amount</Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function QuoteRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
