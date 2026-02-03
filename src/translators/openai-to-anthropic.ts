const MODEL_MAP: Record<string, string> = {
  "gpt-4": "claude-opus-4-5",
  "gpt-4-turbo": "claude-opus-4-5",
  "gpt-3.5-turbo": "claude-sonnet-4-5",
};

export function translateRequest(openaiRequest: any): any {
  const anthropicRequest: any = {
    model: MODEL_MAP[openaiRequest.model] || openaiRequest.model,
    messages: [],
  };

  // Extract system message if present
  const messages = openaiRequest.messages || [];
  if (messages.length > 0 && messages[0].role === "system") {
    anthropicRequest.system = messages[0].content;
    anthropicRequest.messages = messages.slice(1);
  } else {
    anthropicRequest.messages = messages;
  }

  // Direct mappings
  if (openaiRequest.max_tokens !== undefined) {
    anthropicRequest.max_tokens = openaiRequest.max_tokens;
  }
  if (openaiRequest.temperature !== undefined) {
    anthropicRequest.temperature = openaiRequest.temperature;
  }
  if (openaiRequest.top_p !== undefined) {
    anthropicRequest.top_p = openaiRequest.top_p;
  }
  if (openaiRequest.stream !== undefined) {
    anthropicRequest.stream = openaiRequest.stream;
  }

  // Rename stop to stop_sequences
  if (openaiRequest.stop !== undefined) {
    anthropicRequest.stop_sequences = Array.isArray(openaiRequest.stop)
      ? openaiRequest.stop
      : [openaiRequest.stop];
  }

  return anthropicRequest;
}
