"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

export function ConnectWalletButton() {
  return (
    <ConnectButton.Custom>
      {({ openConnectModal }) => (
        <button
          onClick={openConnectModal}
          className="glow-accent w-full rounded-xl bg-accent py-3.5 text-sm font-semibold text-white transition-all hover:bg-accent-hover active:scale-[0.98]"
        >
          Connect Wallet
        </button>
      )}
    </ConnectButton.Custom>
  );
}
