"use client";

import { useEffect, useMemo, useState } from "react";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useSwap, type UseSwapParams } from "@zahastudio/uniswap-sdk-react";
import { AlertTriangleIcon, ArrowDownUpIcon, CheckCircle2Icon, Loader2Icon } from "lucide-react";
import { type Address, zeroAddress } from "viem";
import { useAccount, useBalance } from "wagmi";

import type { SwapMode, SwapToken } from "@/components/swap/types";

import { QuoteDetails } from "@/components/swap/quote-details";
import {
  DEFAULT_INPUT_TOKEN,
  DEFAULT_OUTPUT_TOKEN,
  DEFAULT_SWAP_ROUTE,
  MAINNET_CHAIN_ID,
  SUPPORTED_TOKENS,
  findSwapRoute,
  isSameAddress,
} from "@/components/swap/routes";
import { SwapLifecyclePanel } from "@/components/swap/swap-lifecycle";
import { SwapSettings } from "@/components/swap/swap-settings";
import { TokenSelector } from "@/components/swap/token-selector";
import { formatTokenAmount, normalizeAmountInput, parseTokenAmount } from "@/components/swap/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type SwapCompletionSummary = {
  inputAmount: string;
  inputSymbol: string;
  outputAmount: string;
  outputSymbol: string;
  routeLabel: string;
};

export function SwapForm() {
  const { address, isConnected } = useAccount();
  const [mode, setMode] = useState<SwapMode>("exactInput");
  const [inputToken, setInputToken] = useState<SwapToken>(DEFAULT_INPUT_TOKEN);
  const [outputToken, setOutputToken] = useState<SwapToken>(DEFAULT_OUTPUT_TOKEN);
  const [inputAmount, setInputAmount] = useState("");
  const [outputAmount, setOutputAmount] = useState("");
  const [slippageBps, setSlippageBps] = useState(50);
  const [useNativeToken, setUseNativeToken] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [completionSummary, setCompletionSummary] = useState<SwapCompletionSummary | null>(null);
  const [completionDismissed, setCompletionDismissed] = useState(false);
  const [balanceRefreshKey, setBalanceRefreshKey] = useState(0);

  const routeDefinition = useMemo(() => findSwapRoute(inputToken, outputToken), [inputToken, outputToken]);
  const safeRouteDefinition = routeDefinition ?? DEFAULT_SWAP_ROUTE;
  const exactAmountText = mode === "exactInput" ? inputAmount : outputAmount;
  const exactToken = mode === "exactInput" ? inputToken : outputToken;
  const parsedExactAmount = useMemo(
    () => parseTokenAmount(exactAmountText, exactToken.decimals),
    [exactAmountText, exactToken.decimals],
  );
  const amountIsInvalid = parsedExactAmount === null;
  const canQuote = !!routeDefinition && parsedExactAmount !== null && parsedExactAmount > 0n;
  const safeInputToken = routeDefinition ? inputToken : DEFAULT_INPUT_TOKEN;
  const safeOutputToken = routeDefinition ? outputToken : DEFAULT_OUTPUT_TOKEN;
  const safeAmount: bigint = canQuote && parsedExactAmount !== null ? parsedExactAmount : 0n;

  const swapParams = useMemo<UseSwapParams>(() => {
    if (mode === "exactOutput") {
      return {
        route: safeRouteDefinition.route,
        exactOutput: {
          currency: safeOutputToken.address,
          amount: safeAmount,
        },
        slippageBps,
        useNativeToken,
      };
    }

    return {
      route: safeRouteDefinition.route,
      exactInput: {
        currency: safeInputToken.address,
        amount: safeAmount,
      },
      slippageBps,
      useNativeToken,
    };
  }, [
    mode,
    safeAmount,
    safeInputToken.address,
    safeOutputToken.address,
    safeRouteDefinition.route,
    slippageBps,
    useNativeToken,
  ]);

  const swap = useSwap(swapParams, {
    chainId: MAINNET_CHAIN_ID,
    enabled: canQuote,
    refetchInterval: 12000,
  });

  const quote = swap.steps.quote.data;
  const quotedInputAmount = quote ? formatTokenAmount(quote.amountIn, inputToken.decimals, 8) : "";
  const quotedOutputAmount = quote ? formatTokenAmount(quote.amountOut, outputToken.decimals, 8) : "";
  const displayInputAmount = mode === "exactInput" ? inputAmount : quotedInputAmount;
  const displayOutputAmount = mode === "exactOutput" ? outputAmount : quotedOutputAmount;
  const isBusy =
    swap.steps.approval.transaction.status === "pending" ||
    swap.steps.approval.transaction.status === "confirming" ||
    swap.steps.permit2.isPending ||
    swap.steps.swap.transaction.status === "pending" ||
    swap.steps.swap.transaction.status === "confirming";
  const sdkError =
    actionError ??
    swap.steps.quote.error?.message ??
    swap.steps.approval.transaction.error?.message ??
    swap.steps.permit2.error?.message ??
    swap.steps.swap.transaction.error?.message;
  const primaryLabel = getPrimaryLabel({
    canQuote,
    amountIsInvalid,
    exactAmountText,
    quoteError: swap.steps.quote.error?.message,
    quoteLoading: swap.steps.quote.isLoading || swap.steps.quote.isFetching,
    currentStep: swap.currentStep,
    inputToken,
  });
  const connectedActionDisabled =
    !canQuote ||
    !quote ||
    amountIsInvalid ||
    !!swap.steps.quote.error ||
    isBusy ||
    (swap.currentStep === "approval" && swap.steps.approval.isRequired === undefined);

  useEffect(() => {
    if (swap.currentStep !== "completed") {
      setCompletionDismissed(false);
      return;
    }

    if (!quote || completionSummary || completionDismissed) {
      return;
    }

    setCompletionSummary({
      inputAmount: formatTokenAmount(quote.amountIn, inputToken.decimals, 8),
      inputSymbol: inputToken.symbol,
      outputAmount: formatTokenAmount(quote.amountOut, outputToken.decimals, 8),
      outputSymbol: outputToken.symbol,
      routeLabel: routeDefinition?.label ?? `${inputToken.symbol} / ${outputToken.symbol}`,
    });
    setBalanceRefreshKey((key) => key + 1);
  }, [
    completionDismissed,
    completionSummary,
    inputToken.decimals,
    inputToken.symbol,
    outputToken.decimals,
    outputToken.symbol,
    quote,
    routeDefinition?.label,
    swap.currentStep,
  ]);

  function handleAmountChange(nextValue: string, nextMode: SwapMode) {
    setActionError(null);
    const normalized = normalizeAmountInput(nextValue);
    if (nextMode === "exactInput") {
      setInputAmount(normalized);
    } else {
      setOutputAmount(normalized);
    }
  }

  function handleSwitchTokens() {
    setActionError(null);
    setInputToken(outputToken);
    setOutputToken(inputToken);
    setInputAmount("");
    setOutputAmount("");
  }

  async function handlePrimaryAction() {
    setActionError(null);

    try {
      if (swap.currentStep === "approval") {
        await swap.steps.approval.approve();
        return;
      }
      if (swap.currentStep === "permit2") {
        await swap.steps.permit2.sign();
        return;
      }
      if (swap.currentStep === "swap") {
        await swap.steps.swap.execute();
        return;
      }
      if (swap.currentStep === "completed") {
        swap.reset();
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleExecuteAll() {
    setActionError(null);

    try {
      await swap.executeAll();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleExecuteBatch() {
    setActionError(null);

    try {
      await swap.executeBatch();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    }
  }

  function handleCompletionDone() {
    setCompletionDismissed(true);
    setCompletionSummary(null);
    setActionError(null);
    swap.reset();
  }

  return (
    <>
      <div className="mx-auto grid w-full max-w-5xl gap-4 lg:grid-cols-[minmax(16rem,21rem)_minmax(0,35rem)] lg:items-start lg:justify-center">
        <div className="flex w-full flex-col gap-4">
          <Card size="sm">
            <CardHeader>
              <CardTitle>Settings</CardTitle>
              <CardDescription>Slippage and native ETH</CardDescription>
            </CardHeader>
            <CardContent>
              <SwapSettings
                onSlippageChange={setSlippageBps}
                onUseNativeTokenChange={(value) => {
                  setActionError(null);
                  setUseNativeToken(value);
                }}
                slippageBps={slippageBps}
                useNativeToken={useNativeToken}
              />
            </CardContent>
          </Card>
          <SwapLifecyclePanel
            amountIsInvalid={amountIsInvalid}
            canQuote={canQuote}
            exactAmountText={exactAmountText}
            inputToken={inputToken}
            isConnected={isConnected}
            mode={mode}
            outputToken={outputToken}
            quote={quote}
            routeDefinition={routeDefinition}
            slippageBps={slippageBps}
            swap={swap}
            useNativeToken={useNativeToken}
          />
        </div>
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Swap with the SDK</CardTitle>
            <CardDescription>
              Quotes, Permit2, approvals, and execution are driven by `@zahastudio/uniswap-sdk-react`.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Tabs
              onValueChange={(value) => {
                setActionError(null);
                setMode(value as SwapMode);
              }}
              value={mode}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="exactInput">Exact input</TabsTrigger>
                <TabsTrigger value="exactOutput">Exact output</TabsTrigger>
              </TabsList>
            </Tabs>

            <FieldGroup>
              <TokenAmountField
                accountAddress={address}
                amount={displayInputAmount}
                balanceRefreshKey={balanceRefreshKey}
                isConnected={isConnected}
                label="You pay"
                onAmountChange={(value) => handleAmountChange(value, "exactInput")}
                onTokenSelect={setInputToken}
                readOnly={mode === "exactOutput"}
                selectedToken={inputToken}
                tokens={SUPPORTED_TOKENS}
                disabledToken={outputToken}
              />
              <div className="flex justify-center">
                <Button
                  aria-label="Switch tokens"
                  onClick={handleSwitchTokens}
                  size="icon-sm"
                  type="button"
                  variant="outline"
                >
                  <ArrowDownUpIcon />
                </Button>
              </div>
              <TokenAmountField
                accountAddress={address}
                amount={displayOutputAmount}
                balanceRefreshKey={balanceRefreshKey}
                isConnected={isConnected}
                label="You receive"
                onAmountChange={(value) => handleAmountChange(value, "exactOutput")}
                onTokenSelect={setOutputToken}
                readOnly={mode === "exactInput"}
                selectedToken={outputToken}
                tokens={SUPPORTED_TOKENS}
                disabledToken={inputToken}
              />
            </FieldGroup>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Ethereum mainnet</Badge>
              <Badge variant={routeDefinition ? "outline" : "destructive"}>
                {routeDefinition?.label ?? "Unsupported pair"}
              </Badge>
              {routeDefinition && <Badge variant="outline">{routeDefinition.feeLabel}</Badge>}
            </div>

            {amountIsInvalid && (
              <SwapAlert
                description="Use a decimal amount that fits the selected token decimals."
                title="Invalid amount"
                variant="destructive"
              />
            )}
            {!routeDefinition && (
              <SwapAlert
                description="Pick one of the curated high-liquidity mainnet pairs so the SDK can build a valid PoolKey route."
                title="Unsupported route"
                variant="destructive"
              />
            )}
            {slippageBps > 100 && (
              <SwapAlert
                description="The SDK will allow more than 1% execution movement with this setting."
                title="High slippage"
              />
            )}
            {sdkError && (
              <SwapAlert
                description={sdkError}
                title="SDK action needs attention"
                variant="destructive"
              />
            )}

            <QuoteDetails
              inputToken={inputToken}
              isLoading={swap.steps.quote.isLoading || swap.steps.quote.isFetching}
              mode={mode}
              outputToken={outputToken}
              quote={quote}
              routeDefinition={routeDefinition}
              slippageBps={slippageBps}
            />

            <Separator />

            <div className="flex flex-col gap-2">
              <WalletActionButton
                disabled={connectedActionDisabled}
                isBusy={isBusy}
                label={primaryLabel}
                onClick={handlePrimaryAction}
              />
              <Button
                disabled={!isConnected || connectedActionDisabled || swap.currentStep === "completed"}
                onClick={handleExecuteAll}
                type="button"
                variant="outline"
              >
                Run all SDK steps
              </Button>
              <Button
                disabled={
                  !isConnected ||
                  connectedActionDisabled ||
                  swap.currentStep === "completed" ||
                  !swap.steps.swap.transaction.isAtomicBatchSupported
                }
                onClick={handleExecuteBatch}
                type="button"
                variant="outline"
              >
                Run atomic batch
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <SwapCompletionDialog
        onDone={handleCompletionDone}
        summary={completionSummary}
      />
    </>
  );
}

function TokenAmountField({
  label,
  accountAddress,
  isConnected,
  balanceRefreshKey,
  amount,
  readOnly,
  selectedToken,
  tokens,
  disabledToken,
  onAmountChange,
  onTokenSelect,
}: {
  label: string;
  accountAddress: Address | undefined;
  isConnected: boolean;
  balanceRefreshKey: number;
  amount: string;
  readOnly: boolean;
  selectedToken: SwapToken;
  tokens: readonly SwapToken[];
  disabledToken: SwapToken;
  onAmountChange: (value: string) => void;
  onTokenSelect: (token: SwapToken) => void;
}) {
  const balanceToken = isSameAddress(selectedToken.address, zeroAddress) ? undefined : selectedToken.address;
  const balance = useBalance({
    address: accountAddress,
    chainId: MAINNET_CHAIN_ID,
    token: balanceToken,
    query: {
      enabled: isConnected && !!accountAddress,
    },
  });

  useEffect(() => {
    if (balanceRefreshKey === 0 || !isConnected || !accountAddress) {
      return;
    }

    void balance.refetch();
  }, [accountAddress, balance.refetch, balanceRefreshKey, isConnected]);

  const balanceLabel = getBalanceLabel({
    balance: balance.data?.value,
    decimals: selectedToken.decimals,
    isConnected,
    isError: balance.isError,
    isLoading: balance.isLoading,
    symbol: selectedToken.symbol,
  });

  return (
    <Field>
      <div className="flex items-center justify-between gap-3">
        <FieldLabel>{label}</FieldLabel>
        <FieldDescription className="text-right whitespace-nowrap">{balanceLabel}</FieldDescription>
      </div>
      <InputGroup className="h-16 rounded-xl">
        <InputGroupInput
          aria-label={`${label} amount`}
          className="h-14 text-2xl!"
          inputMode="decimal"
          onChange={(event) => onAmountChange(event.target.value)}
          placeholder="0"
          readOnly={readOnly}
          value={amount}
        />
        <InputGroupAddon
          align="inline-end"
          className="text-foreground cursor-default pr-3 has-[>button]:mr-0!"
        >
          <TokenSelector
            disabledToken={disabledToken}
            label={`Select token for ${label.toLowerCase()}`}
            onSelect={(token) => {
              if (!isSameAddress(token.address, disabledToken.address)) {
                onTokenSelect(token);
              }
            }}
            selectedToken={selectedToken}
            tokens={tokens}
          />
        </InputGroupAddon>
      </InputGroup>
    </Field>
  );
}

function SwapCompletionDialog({
  summary,
  onDone,
}: {
  summary: SwapCompletionSummary | null;
  onDone: () => void;
}) {
  return (
    <Dialog
      open={summary !== null}
      onOpenChange={(open) => {
        if (!open && summary) {
          onDone();
        }
      }}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <div className="bg-primary text-primary-foreground mb-1 flex size-9 items-center justify-center rounded-full">
            <CheckCircle2Icon className="size-5" />
          </div>
          <DialogTitle>Swap completed</DialogTitle>
          <DialogDescription>Your swap was confirmed on Ethereum mainnet.</DialogDescription>
        </DialogHeader>

        {summary && (
          <div className="grid gap-3 rounded-lg border bg-muted/30 p-3">
            <CompletionRow
              label="Paid"
              value={`${summary.inputAmount} ${summary.inputSymbol}`}
            />
            <CompletionRow
              label="Received"
              value={`${summary.outputAmount} ${summary.outputSymbol}`}
            />
            <CompletionRow
              label="Route"
              value={summary.routeLabel}
            />
          </div>
        )}

        <DialogFooter>
          <Button
            className="w-full sm:w-auto"
            onClick={onDone}
            type="button"
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CompletionRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function getBalanceLabel({
  balance,
  decimals,
  isConnected,
  isError,
  isLoading,
  symbol,
}: {
  balance: bigint | undefined;
  decimals: number;
  isConnected: boolean;
  isError: boolean;
  isLoading: boolean;
  symbol: string;
}) {
  if (!isConnected) {
    return "Balance: --";
  }
  if (isLoading) {
    return "Balance: Loading";
  }
  if (isError) {
    return "Balance: Unavailable";
  }

  return `Balance: ${formatTokenAmount(balance ?? 0n, decimals, 6)} ${symbol}`;
}

function WalletActionButton({
  label,
  disabled,
  isBusy,
  onClick,
}: {
  label: string;
  disabled: boolean;
  isBusy: boolean;
  onClick: () => void;
}) {
  return (
    <ConnectButton.Custom>
      {({ account, chain, mounted, openChainModal, openConnectModal }) => {
        const connected = mounted && account && chain;

        if (!connected) {
          return (
            <Button
              className="w-full"
              onClick={() => openConnectModal?.()}
              type="button"
            >
              Connect wallet
            </Button>
          );
        }

        if (chain.unsupported) {
          return (
            <Button
              className="w-full"
              onClick={() => openChainModal?.()}
              type="button"
              variant="destructive"
            >
              Switch to Ethereum
            </Button>
          );
        }

        return (
          <Button
            className="w-full"
            disabled={disabled}
            onClick={onClick}
            type="button"
          >
            {isBusy && <Loader2Icon className="animate-spin" />}
            {label}
          </Button>
        );
      }}
    </ConnectButton.Custom>
  );
}

function SwapAlert({
  title,
  description,
  variant,
}: {
  title: string;
  description: string;
  variant?: "default" | "destructive";
}) {
  return (
    <Alert variant={variant}>
      <AlertTriangleIcon />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{description}</AlertDescription>
    </Alert>
  );
}

function getPrimaryLabel({
  canQuote,
  amountIsInvalid,
  exactAmountText,
  quoteError,
  quoteLoading,
  currentStep,
  inputToken,
}: {
  canQuote: boolean;
  amountIsInvalid: boolean;
  exactAmountText: string;
  quoteError: string | undefined;
  quoteLoading: boolean;
  currentStep: "quote" | "approval" | "permit2" | "swap" | "completed";
  inputToken: SwapToken;
}) {
  if (!exactAmountText) {
    return "Enter an amount";
  }
  if (amountIsInvalid) {
    return "Enter a valid amount";
  }
  if (!canQuote) {
    return "Select a supported pair";
  }
  if (quoteLoading) {
    return "Fetching quote";
  }
  if (quoteError) {
    return "Swap unavailable";
  }
  if (currentStep === "approval") {
    return `Approve ${inputToken.symbol}`;
  }
  if (currentStep === "permit2") {
    return "Sign Permit2";
  }
  if (currentStep === "completed") {
    return "Swap complete";
  }

  return "Swap";
}
