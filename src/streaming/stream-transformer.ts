const STOP_REASON_MAP: Record<string, string> = {
  "end_turn": "stop",
  "max_tokens": "length",
  "stop_sequence": "stop",
};

export function transformAnthropicChunkToOpenAI(
  chunk: any,
  requestedModel: string,
  messageId: string
): any {
  const baseChunk = {
    id: messageId,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model: requestedModel,
    choices: [
      {
        index: 0,
        delta: {},
        finish_reason: null
      }
    ]
  };

  // Handle different event types
  if (chunk.type === "message_start") {
    return baseChunk;
  }

  if (chunk.type === "content_block_delta" && chunk.delta?.text) {
    baseChunk.choices[0].delta = { content: chunk.delta.text };
    return baseChunk;
  }

  if (chunk.type === "message_delta" && chunk.delta?.stop_reason) {
    baseChunk.choices[0].finish_reason = STOP_REASON_MAP[chunk.delta.stop_reason] || "stop";
    return baseChunk;
  }

  return baseChunk;
}

export function formatSSE(data: any): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export function formatDoneSSE(): string {
  return "data: [DONE]\n\n";
}
