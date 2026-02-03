import type { PoolTransform, ParameterOverrides } from "./types";

/**
 * Apply model remapping to a request
 * Maps client model names to Anthropic model names based on pool config
 */
export function applyModelRemap(
  request: any,
  modelRemap?: Record<string, string[]>
): void {
  if (!modelRemap || !request.model) {
    return;
  }

  // Build reverse map: client-model → anthropic-model
  const reverseMap: Record<string, string> = {};
  for (const [anthropicModel, clientModels] of Object.entries(modelRemap)) {
    for (const clientModel of clientModels) {
      reverseMap[clientModel] = anthropicModel;
    }
  }

  // Check if request model is in the reverse map
  const mappedModel = reverseMap[request.model];
  if (mappedModel) {
    request.model = mappedModel;
  }
}

/**
 * Apply parameter overrides to a request
 * Force specific parameter values as defined in pool config
 */
export function applyParameterOverrides(
  request: any,
  overrides?: ParameterOverrides
): void {
  if (!overrides) {
    return;
  }

  // Apply each override
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined) {
      request[key] = value;
    }
  }
}

/**
 * Apply complete pool transformation (model remap + parameter overrides)
 */
export function applyPoolTransform(
  request: any,
  transform?: PoolTransform
): void {
  if (!transform) {
    return;
  }

  // Apply model remap first
  applyModelRemap(request, transform.modelRemap);

  // Then apply parameter overrides
  applyParameterOverrides(request, transform.parameterOverrides);
}
