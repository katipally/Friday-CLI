import type { SpiderExpression } from '@fridaycode/shared';

/**
 * Spider expression eye patterns.
 * Each expression maps to a pair of eye characters with color hints.
 */
export const EXPRESSIONS: Record<SpiderExpression, { left: string; right: string; color: string }> = {
  idle:     { left: '◉', right: '◉', color: 'cyan' },
  thinking: { left: '◎', right: '◎', color: 'violet' },
  success:  { left: '✦', right: '✦', color: 'green' },
  error:    { left: '⊗', right: '⊗', color: 'rose' },
  working:  { left: '◉', right: '◉', color: 'amber' },
  greeting: { left: '★', right: '★', color: 'green' },
  confused: { left: '◌', right: '◌', color: 'rose' },
};

/**
 * Get the eyes for a given expression.
 */
export function getEyes(expression: SpiderExpression): string {
  const e = EXPRESSIONS[expression];
  return `(${e.left} ${e.right})`;
}
