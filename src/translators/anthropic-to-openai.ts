const STOP_REASON_MAP: Record<string, string> = {
  "end_turn": "stop",
  "max_tokens": "length",
  "stop_sequence": "stop",
};

export function translateResponse(anthropicResponse: any, requestedModel: string): any {
  const content = anthropicResponse.content?.[0]?.text || "";

  return {
    id: anthropicResponse.id,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: requestedModel,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: content
        },
        finish_reason: STOP_REASON_MAP[anthropicResponse.stop_reason] || "stop"
      }
    ],
    usage: {
      prompt_tokens: anthropicResponse.usage?.input_tokens || 0,
      completion_tokens: anthropicResponse.usage?.output_tokens || 0,
      total_tokens: (anthropicResponse.usage?.input_tokens || 0) + (anthropicResponse.usage?.output_tokens || 0)
    }
  };
}
