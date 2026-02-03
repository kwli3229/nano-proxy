export enum Format {
  OpenAI = "openai",
  Anthropic = "anthropic",
  Unknown = "unknown"
}

export function detectFormat(path: string): Format {
  if (path === "/v1/chat/completions") {
    return Format.OpenAI;
  }

  if (path === "/v1/messages") {
    return Format.Anthropic;
  }

  return Format.Unknown;
}
