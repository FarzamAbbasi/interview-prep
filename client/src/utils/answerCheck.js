// IPP-1729: "2 of 2 free practice checks left today" (usage = { kind, limit, remaining, plan } from /api/answer-check)
export function checksLeftText(usage) {
  if (!usage) return '';
  return `${usage.remaining} of ${usage.limit} ${usage.plan === 'free' ? 'free ' : ''}${usage.kind ? `${usage.kind} ` : ''}checks left today`;
}

// IPP-1730: shortest typed answer that is sent to the AI (same as the server rule)
export const MIN_ANSWER_CHARS = 10;
