export function translateRequest(openaiRequest: any): any {
  const anthropicRequest: any = {
    model: openaiRequest.model,  // Pass through as-is, pool transform will handle remapping
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
