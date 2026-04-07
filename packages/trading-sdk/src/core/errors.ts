export interface TradingApiErrorOptions {
  status: number;
  errorCode?: string;
  detail?: string;
  requestId?: string;
}

export class TradingApiError extends Error {
  public readonly status: number;
  public readonly errorCode?: string;
  public readonly detail?: string;
  public readonly requestId?: string;

  public constructor(options: TradingApiErrorOptions) {
    const message = options.detail ?? options.errorCode ?? `Trading API request failed with status ${options.status}.`;
    super(message);
    this.name = "TradingApiError";
    this.status = options.status;
    this.errorCode = options.errorCode;
    this.detail = options.detail;
    this.requestId = options.requestId;
  }
}
