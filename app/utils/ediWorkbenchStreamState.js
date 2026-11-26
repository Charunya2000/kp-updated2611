export const MAX_RETAINED_EDI_FINDINGS = 500;

export function appendBoundedValidationFindings(
  currentState,
  findings,
  limit = MAX_RETAINED_EDI_FINDINGS,
) {
  const batch = Array.isArray(findings) ? findings : [];
  const retained = Array.isArray(currentState?.findingPreview) ? currentState.findingPreview : [];
  const remainingCapacity = Math.max(0, limit - retained.length);

  return {
    findingCount: Number(currentState?.findingCount || 0) + batch.length,
    findingPreview: remainingCapacity > 0
      ? [...retained, ...batch.slice(0, remainingCapacity)]
      : retained,
  };
}