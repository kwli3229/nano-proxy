const ERROR_TYPE_MAP: Record<string, string> = {
  "invalid_request_error": "invalid_request_error",
  "authentication_error": "invalid_api_key",
  "permission_error": "insufficient_quota",
  "not_found_error": "model_not_found",
  "rate_limit_error": "rate_limit_exceeded",
  "api_error": "server_error",
  "overloaded_error": "server_error",
};

export function translateError(error: any, statusCode?: number): any {
  // Handle string errors
  if (typeof error === "string") {
    return {
      error: {
        message: error,
        type: "server_error",
        code: "server_error"
      }
    };
  }

  // Handle Anthropic error format
  if (error.type === "error" && error.error) {
    const anthropicError = error.error;
    return {
      error: {
        message: anthropicError.message,
        type: "invalid_request_error",
        code: ERROR_TYPE_MAP[anthropicError.type] || "server_error"
      }
    };
  }

  // Fallback
  return {
    error: {
      message: error.message || "Unknown error",
      type: "server_error",
      code: "server_error"
    }
  };
}
