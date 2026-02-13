import type { Metadata } from "next";

import { ClientProviders } from "./client-providers";

import "./globals.css";

export const metadata: Metadata = {
  title: "Uniswap SDK — Example",
  description: "",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className="dark"
    >
      <body className="bg-background min-h-screen antialiased">
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
