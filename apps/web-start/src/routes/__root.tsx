import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { Web3Provider } from "@/components/providers/web3-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "TanStack Start Starter",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  notFoundComponent: () => (
    <main className="container mx-auto p-4 pt-16">
      <h1>404</h1>
      <p>The requested page could not be found.</p>
    </main>
  ),
  shellComponent: RootDocument,
  ssr: false,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <Web3Provider>
          <TooltipProvider>
            <AppShell>{children}</AppShell>
          </TooltipProvider>
        </Web3Provider>
        <Scripts />
      </body>
    </html>
  );
}
