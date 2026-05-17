"use client";

import { useState } from "react";

import { ChevronDownIcon } from "lucide-react";

import type { SwapToken } from "@/components/swap/types";

import { isSameAddress } from "@/components/swap/routes";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function TokenSelector({
  label,
  selectedToken,
  tokens,
  disabledToken,
  onSelect,
}: {
  label: string;
  selectedToken: SwapToken;
  tokens: readonly SwapToken[];
  disabledToken?: SwapToken;
  onSelect: (token: SwapToken) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
    >
      <DialogTrigger asChild>
        <Button
          aria-label={label}
          className="text-foreground h-9 shrink-0 gap-2.5 rounded-full px-2.5 pr-2 [&_svg:not([class*='size-'])]:size-4"
          size="sm"
          type="button"
          variant="outline"
        >
          <TokenAvatar token={selectedToken} />
          <span className="leading-none">{selectedToken.symbol}</span>
          <ChevronDownIcon />
        </Button>
      </DialogTrigger>
      <DialogContent className="gap-0 p-0 sm:max-w-md">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>Choose a token supported by the curated Uniswap v4 SDK routes.</DialogDescription>
        </DialogHeader>
        <Command>
          <CommandInput placeholder="Search by token or symbol..." />
          <CommandList className="max-h-96">
            <CommandEmpty>No supported token found.</CommandEmpty>
            <CommandGroup heading="Ethereum mainnet">
              {tokens.map((token) => {
                const selected = isSameAddress(token.address, selectedToken.address);
                const disabled = !!disabledToken && isSameAddress(token.address, disabledToken.address);

                return (
                  <CommandItem
                    data-checked={selected}
                    disabled={disabled}
                    key={token.address}
                    onSelect={() => {
                      onSelect(token);
                      setOpen(false);
                    }}
                    value={`${token.symbol} ${token.name}`}
                  >
                    <TokenAvatar token={token} />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="font-medium">{token.symbol}</span>
                      <span className="text-muted-foreground truncate text-xs">{token.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {token.tags?.map((tag) => (
                        <Badge
                          key={tag}
                          variant="outline"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

export function TokenAvatar({ token }: { token: SwapToken }) {
  return (
    <Avatar className="size-6">
      {token.logoUrl && <AvatarImage src={token.logoUrl} />}
      <AvatarFallback className="text-[10px]">{token.symbol.slice(0, 2)}</AvatarFallback>
    </Avatar>
  );
}
