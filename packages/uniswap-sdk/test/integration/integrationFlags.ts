export const integrationEnabled = process.env.INTEGRATION !== "0";

export const describeIntegration = integrationEnabled ? describe : describe.skip;
