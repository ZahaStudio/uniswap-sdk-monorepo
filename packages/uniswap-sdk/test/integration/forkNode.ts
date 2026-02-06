import { createServer } from "prool";
import { anvil } from "prool/instances";

import { MAINNET_FORK_BLOCK_NUMBER } from "@/test/fixtures/mainnet";

type ForkNodeInstance = {
  url: string;
  stop: () => Promise<void>;
};

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(errorMessage));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

export const startForkNode = async (): Promise<ForkNodeInstance> => {
  const forkUrl = process.env.MAINNET_RPC_URL ?? "https://unichain.drpc.org";
  const port = Number(process.env.ANVIL_PORT ?? String(10_000 + Math.floor(Math.random() * 10_000)));
  const chainId = Number(process.env.FORK_CHAIN_ID ?? "130");
  const startupTimeoutMs = Number(process.env.ANVIL_STARTUP_TIMEOUT_MS ?? "60000");

  const server = createServer({
    instance: anvil({
      chainId,
      forkUrl,
      forkBlockNumber: BigInt(MAINNET_FORK_BLOCK_NUMBER),
    }),
    host: "127.0.0.1",
    port,
  });

  await withTimeout(server.start(), startupTimeoutMs, `Fork node did not start within ${startupTimeoutMs}ms`);

  return {
    url: `http://127.0.0.1:${port}/1`,
    stop: async () => {
      await server.stop();
    },
  };
};

export const stopForkNode = async (instance: ForkNodeInstance) => {
  await instance.stop();
};
