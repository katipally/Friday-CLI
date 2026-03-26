import type { SpiderExpression } from '@fridaycode/shared';

/**
 * Spider expression eye patterns.
 * Each expression maps to a pair of eye characters.
 */
export const EXPRESSIONS: Record<SpiderExpression, { left: string; right: string }> = {
  idle: { left: '- ', right: ' -' },
  thinking: { left: '• ', right: ' •' },
  success: { left: '^ ', right: ' ^' },
  error: { left: 'O ', right: ' O' },
  working: { left: '> ', right: ' <' },
  greeting: { left: '◕ ', right: ' ◕' },
  confused: { left: '? ', right: ' ?' },
};

/**
 * Get the eyes for a given expression.
 */
export function getEyes(expression: SpiderExpression): string {
  const e = EXPRESSIONS[expression];
  return `(${e.left}${e.right})`;
}
