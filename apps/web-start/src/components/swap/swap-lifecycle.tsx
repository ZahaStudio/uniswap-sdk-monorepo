"use client";

import type { QuoteData, SwapStep, UseSwapReturn } from "@zahastudio/uniswap-sdk-react";

import {
  CheckCircle2Icon,
  CircleDashedIcon,
  CircleIcon,
  Clock3Icon,
  FileSignatureIcon,
  RefreshCwIcon,
  SendIcon,
  ShieldCheckIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { zeroAddress } from "viem";

import type { SwapMode, SwapRouteDefinition, SwapToken } from "@/components/swap/types";

import { formatBps } from "@/components/swap/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type LifecycleState = "active" | "blocked" | "complete" | "error" | "pending" | "skipped";

type LifecycleStep = {
  id: SwapStep;
  label: string;
  description: string;
  state: LifecycleState;
  detail: string;
  icon: typeof RefreshCwIcon;
};

type SwapLifecyclePanelProps = {
  swap: UseSwapReturn<"exactInput" | "exactOutput">;
  mode: SwapMode;
  inputToken: SwapToken;
  outputToken: SwapToken;
  routeDefinition: SwapRouteDefinition | undefined;
  exactAmountText: string;
  amountIsInvalid: boolean;
  canQuote: boolean;
  isConnected: boolean;
  slippageBps: number;
  useNativeToken: boolean;
  quote: QuoteData | undefined;
};

export function SwapLifecyclePanel({
  swap,
  mode,
  inputToken,
  outputToken,
  routeDefinition,
  exactAmountText,
  amountIsInvalid,
  canQuote,
  isConnected,
  slippageBps,
  useNativeToken,
  quote,
}: SwapLifecyclePanelProps) {
  const quoteLoading = swap.steps.quote.isLoading || swap.steps.quote.isFetching;
  const quoteError = swap.steps.quote.error?.message;
  const isNativeInput = swap.meta.resolvedCurrencyIn.toLowerCase() === zeroAddress.toLowerCase();
  const approvalStatus = swap.steps.approval.transaction.status;
  const swapStatus = swap.steps.swap.transaction.status;
  const steps = getLifecycleSteps({
    swap,
    quote,
    quoteLoading,
    quoteError,
    exactAmountText,
    amountIsInvalid,
    canQuote,
    isConnected,
    isNativeInput,
    inputToken,
    approvalStatus,
    swapStatus,
  });

  return (
    <Card className="w-full lg:sticky lg:top-4 lg:self-start">
      <CardHeader>
        <CardTitle>Swap lifecycle</CardTitle>
        <CardDescription>Live SDK state for quote, approval, Permit2, and execution.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ol
          className="flex flex-col gap-3"
          aria-label="Swap lifecycle steps"
        >
          {steps.map((step, index) => (
            <li
              className="grid grid-cols-[1.5rem_1fr] gap-3"
              key={step.id}
            >
              <div className="flex flex-col items-center">
                <StepIcon
                  icon={step.icon}
                  state={step.state}
                />
                {index < steps.length - 1 && <span className="mt-2 min-h-5 w-px flex-1 bg-border" />}
              </div>
              <div className="min-w-0 pb-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{step.label}</span>
                  <StepBadge state={step.state} />
                </div>
                <p className="text-muted-foreground mt-1 text-xs">{step.description}</p>
                <p className="mt-1 text-xs">{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>

        <Separator />

        <div className="grid gap-2 text-sm">
          <LifecycleSetting
            label="Mode"
            value={mode === "exactInput" ? "Exact input" : "Exact output"}
          />
          <LifecycleSetting
            label="Route"
            value={routeDefinition?.label ?? "Unsupported"}
          />
          <LifecycleSetting
            label="Slippage"
            value={formatBps(slippageBps)}
          />
          <LifecycleSetting
            label="Native ETH"
            value={useNativeToken ? "On" : "Off"}
          />
          <LifecycleSetting
            label="Atomic batch"
            value={swap.steps.swap.transaction.isAtomicBatchSupported ? "Available" : "Unavailable"}
          />
          <LifecycleSetting
            label="Direction"
            value={`${inputToken.symbol} -> ${outputToken.symbol}`}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function getLifecycleSteps({
  swap,
  quote,
  quoteLoading,
  quoteError,
  exactAmountText,
  amountIsInvalid,
  canQuote,
  isConnected,
  isNativeInput,
  inputToken,
  approvalStatus,
  swapStatus,
}: {
  swap: UseSwapReturn<"exactInput" | "exactOutput">;
  quote: QuoteData | undefined;
  quoteLoading: boolean;
  quoteError: string | undefined;
  exactAmountText: string;
  amountIsInvalid: boolean;
  canQuote: boolean;
  isConnected: boolean;
  isNativeInput: boolean;
  inputToken: SwapToken;
  approvalStatus: UseSwapReturn<"exactInput" | "exactOutput">["steps"]["approval"]["transaction"]["status"];
  swapStatus: UseSwapReturn<"exactInput" | "exactOutput">["steps"]["swap"]["transaction"]["status"];
}): LifecycleStep[] {
  const quoteStep = getQuoteStep({
    quote,
    quoteLoading,
    quoteError,
    exactAmountText,
    amountIsInvalid,
    canQuote,
  });
  const approvalStep = getApprovalStep({
    swap,
    quote,
    isConnected,
    isNativeInput,
    inputToken,
    approvalStatus,
  });
  const permit2Step = getPermit2Step({
    swap,
    quote,
    isConnected,
    isNativeInput,
  });
  const executionStep = getExecutionStep({
    swap,
    quote,
    isConnected,
    swapStatus,
  });

  return [quoteStep, approvalStep, permit2Step, executionStep];
}

function getQuoteStep({
  quote,
  quoteLoading,
  quoteError,
  exactAmountText,
  amountIsInvalid,
  canQuote,
}: {
  quote: QuoteData | undefined;
  quoteLoading: boolean;
  quoteError: string | undefined;
  exactAmountText: string;
  amountIsInvalid: boolean;
  canQuote: boolean;
}): LifecycleStep {
  if (!exactAmountText) {
    return {
      id: "quote",
      label: "Quote",
      description: "Simulate the selected v4 route.",
      state: "pending",
      detail: "Enter an amount to request a quote.",
      icon: RefreshCwIcon,
    };
  }
  if (amountIsInvalid || !canQuote) {
    return {
      id: "quote",
      label: "Quote",
      description: "Simulate the selected v4 route.",
      state: "blocked",
      detail: amountIsInvalid ? "The amount needs to match token decimals." : "Select a supported route pair.",
      icon: RefreshCwIcon,
    };
  }
  if (quoteError) {
    return {
      id: "quote",
      label: "Quote",
      description: "Simulate the selected v4 route.",
      state: "error",
      detail: "The SDK quote returned an error.",
      icon: RefreshCwIcon,
    };
  }
  if (quoteLoading && !quote) {
    return {
      id: "quote",
      label: "Quote",
      description: "Simulate the selected v4 route.",
      state: "active",
      detail: "Fetching the latest quote.",
      icon: RefreshCwIcon,
    };
  }
  if (quote) {
    return {
      id: "quote",
      label: "Quote",
      description: "Simulate the selected v4 route.",
      state: quoteLoading ? "active" : "complete",
      detail: quoteLoading ? "Refreshing the quote." : "Quote is ready.",
      icon: RefreshCwIcon,
    };
  }

  return {
    id: "quote",
    label: "Quote",
    description: "Simulate the selected v4 route.",
    state: "pending",
    detail: "Waiting for quote inputs.",
    icon: RefreshCwIcon,
  };
}

function getApprovalStep({
  swap,
  quote,
  isConnected,
  isNativeInput,
  inputToken,
  approvalStatus,
}: {
  swap: UseSwapReturn<"exactInput" | "exactOutput">;
  quote: QuoteData | undefined;
  isConnected: boolean;
  isNativeInput: boolean;
  inputToken: SwapToken;
  approvalStatus: UseSwapReturn<"exactInput" | "exactOutput">["steps"]["approval"]["transaction"]["status"];
}): LifecycleStep {
  if (isNativeInput) {
    return {
      id: "approval",
      label: "Approval",
      description: "Authorize ERC-20 spending into Permit2.",
      state: "skipped",
      detail: "Native ETH input skips ERC-20 approval.",
      icon: ShieldCheckIcon,
    };
  }
  if (!quote) {
    return {
      id: "approval",
      label: "Approval",
      description: "Authorize ERC-20 spending into Permit2.",
      state: "pending",
      detail: "Waiting for a quote first.",
      icon: ShieldCheckIcon,
    };
  }
  if (!isConnected) {
    return {
      id: "approval",
      label: "Approval",
      description: "Authorize ERC-20 spending into Permit2.",
      state: "blocked",
      detail: "Connect a wallet to check allowance.",
      icon: ShieldCheckIcon,
    };
  }
  if (swap.steps.approval.transaction.error) {
    return {
      id: "approval",
      label: "Approval",
      description: "Authorize ERC-20 spending into Permit2.",
      state: "error",
      detail: "Approval transaction failed.",
      icon: ShieldCheckIcon,
    };
  }
  if (approvalStatus === "pending" || approvalStatus === "confirming") {
    return {
      id: "approval",
      label: "Approval",
      description: "Authorize ERC-20 spending into Permit2.",
      state: "active",
      detail:
        approvalStatus === "pending" ? "Confirm the approval in your wallet." : "Waiting for approval confirmation.",
      icon: ShieldCheckIcon,
    };
  }
  if (swap.steps.approval.isRequired === undefined) {
    return {
      id: "approval",
      label: "Approval",
      description: "Authorize ERC-20 spending into Permit2.",
      state: "active",
      detail: `Checking ${inputToken.symbol} allowance.`,
      icon: ShieldCheckIcon,
    };
  }
  if (swap.steps.approval.isRequired) {
    return {
      id: "approval",
      label: "Approval",
      description: "Authorize ERC-20 spending into Permit2.",
      state: swap.currentStep === "approval" ? "active" : "pending",
      detail: `Approve ${inputToken.symbol} for Permit2.`,
      icon: ShieldCheckIcon,
    };
  }

  return {
    id: "approval",
    label: "Approval",
    description: "Authorize ERC-20 spending into Permit2.",
    state: "complete",
    detail: "Allowance is ready.",
    icon: ShieldCheckIcon,
  };
}

function getPermit2Step({
  swap,
  quote,
  isConnected,
  isNativeInput,
}: {
  swap: UseSwapReturn<"exactInput" | "exactOutput">;
  quote: QuoteData | undefined;
  isConnected: boolean;
  isNativeInput: boolean;
}): LifecycleStep {
  if (isNativeInput) {
    return {
      id: "permit2",
      label: "Permit2",
      description: "Sign the off-chain spend authorization.",
      state: "skipped",
      detail: "Native ETH input skips Permit2 signing.",
      icon: FileSignatureIcon,
    };
  }
  if (!quote) {
    return {
      id: "permit2",
      label: "Permit2",
      description: "Sign the off-chain spend authorization.",
      state: "pending",
      detail: "Waiting for a quote first.",
      icon: FileSignatureIcon,
    };
  }
  if (!isConnected) {
    return {
      id: "permit2",
      label: "Permit2",
      description: "Sign the off-chain spend authorization.",
      state: "blocked",
      detail: "Connect a wallet to prepare the signature.",
      icon: FileSignatureIcon,
    };
  }
  if (!swap.steps.permit2.isRequired) {
    return {
      id: "permit2",
      label: "Permit2",
      description: "Sign the off-chain spend authorization.",
      state: "skipped",
      detail: "Permit2 signing is not required.",
      icon: FileSignatureIcon,
    };
  }
  if (swap.steps.permit2.error) {
    return {
      id: "permit2",
      label: "Permit2",
      description: "Sign the off-chain spend authorization.",
      state: "error",
      detail: "Permit2 signature was rejected or failed.",
      icon: FileSignatureIcon,
    };
  }
  if (swap.steps.permit2.isPending) {
    return {
      id: "permit2",
      label: "Permit2",
      description: "Sign the off-chain spend authorization.",
      state: "active",
      detail: "Confirm the Permit2 signature in your wallet.",
      icon: FileSignatureIcon,
    };
  }
  if (swap.steps.permit2.isSigned) {
    return {
      id: "permit2",
      label: "Permit2",
      description: "Sign the off-chain spend authorization.",
      state: "complete",
      detail: "Permit2 signature is ready.",
      icon: FileSignatureIcon,
    };
  }

  return {
    id: "permit2",
    label: "Permit2",
    description: "Sign the off-chain spend authorization.",
    state: swap.currentStep === "permit2" ? "active" : "pending",
    detail: swap.currentStep === "permit2" ? "Sign Permit2 to continue." : "Waiting for approval.",
    icon: FileSignatureIcon,
  };
}

function getExecutionStep({
  swap,
  quote,
  isConnected,
  swapStatus,
}: {
  swap: UseSwapReturn<"exactInput" | "exactOutput">;
  quote: QuoteData | undefined;
  isConnected: boolean;
  swapStatus: UseSwapReturn<"exactInput" | "exactOutput">["steps"]["swap"]["transaction"]["status"];
}): LifecycleStep {
  if (!quote) {
    return {
      id: "swap",
      label: "Swap",
      description: "Submit the Universal Router transaction.",
      state: "pending",
      detail: "Waiting for a quote first.",
      icon: SendIcon,
    };
  }
  if (!isConnected) {
    return {
      id: "swap",
      label: "Swap",
      description: "Submit the Universal Router transaction.",
      state: "blocked",
      detail: "Connect a wallet to execute.",
      icon: SendIcon,
    };
  }
  if (swap.steps.swap.transaction.error || swapStatus === "error") {
    return {
      id: "swap",
      label: "Swap",
      description: "Submit the Universal Router transaction.",
      state: "error",
      detail: "Swap transaction failed.",
      icon: SendIcon,
    };
  }
  if (swapStatus === "pending" || swapStatus === "confirming") {
    return {
      id: "swap",
      label: "Swap",
      description: "Submit the Universal Router transaction.",
      state: "active",
      detail: swapStatus === "pending" ? "Confirm the swap in your wallet." : "Waiting for swap confirmation.",
      icon: SendIcon,
    };
  }
  if (swapStatus === "confirmed" || swap.currentStep === "completed") {
    return {
      id: "swap",
      label: "Swap",
      description: "Submit the Universal Router transaction.",
      state: "complete",
      detail: "Swap transaction is confirmed.",
      icon: SendIcon,
    };
  }

  return {
    id: "swap",
    label: "Swap",
    description: "Submit the Universal Router transaction.",
    state: swap.currentStep === "swap" ? "active" : "pending",
    detail: swap.currentStep === "swap" ? "Ready to submit the swap." : "Waiting for prior steps.",
    icon: SendIcon,
  };
}

function StepIcon({ icon: Icon, state }: { icon: typeof RefreshCwIcon; state: LifecycleState }) {
  if (state === "complete") {
    return (
      <span className="bg-primary text-primary-foreground flex size-6 shrink-0 items-center justify-center rounded-full">
        <CheckCircle2Icon className="size-3.5" />
      </span>
    );
  }
  if (state === "error" || state === "blocked") {
    return (
      <span className="bg-destructive/10 text-destructive flex size-6 shrink-0 items-center justify-center rounded-full">
        <TriangleAlertIcon className="size-3.5" />
      </span>
    );
  }
  if (state === "active") {
    return (
      <span className="bg-secondary text-secondary-foreground flex size-6 shrink-0 items-center justify-center rounded-full">
        <Icon className="size-3.5" />
      </span>
    );
  }
  if (state === "skipped") {
    return (
      <span className="text-muted-foreground flex size-6 shrink-0 items-center justify-center rounded-full border border-border">
        <CircleDashedIcon className="size-3.5" />
      </span>
    );
  }

  return (
    <span className="text-muted-foreground flex size-6 shrink-0 items-center justify-center rounded-full border border-border">
      <CircleIcon className="size-3" />
    </span>
  );
}

function StepBadge({ state }: { state: LifecycleState }) {
  if (state === "complete") {
    return <Badge variant="secondary">Done</Badge>;
  }
  if (state === "active") {
    return (
      <Badge variant="secondary">
        <Clock3Icon />
        Now
      </Badge>
    );
  }
  if (state === "blocked") {
    return <Badge variant="destructive">Blocked</Badge>;
  }
  if (state === "error") {
    return <Badge variant="destructive">Error</Badge>;
  }
  if (state === "skipped") {
    return <Badge variant="outline">Skipped</Badge>;
  }

  return <Badge variant="outline">Pending</Badge>;
}

function LifecycleSetting({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
