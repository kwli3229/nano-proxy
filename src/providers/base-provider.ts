import type { ProviderKey } from "../types";

export interface BaseProvider {
  makeRequest(request: any, providerKey: ProviderKey): Promise<any>;
  makeStreamingRequest(request: any, providerKey: ProviderKey): Promise<ReadableStream>;
}
