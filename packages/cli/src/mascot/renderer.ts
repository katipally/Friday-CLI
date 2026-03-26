import type { SpiderExpression } from '@fridaycode/shared';
import { ANSI_COLORS } from '@fridaycode/shared';

/**
 * ANSI color helpers for raw terminal output.
 */
function fg256(code: number): string {
  return `\x1b[38;5;${code}m`;
}

function reset(): string {
  return '\x1b[0m';
}

function bold(): string {
  return '\x1b[1m';
}

const V = fg256(ANSI_COLORS.deepViolet);
const G = fg256(ANSI_COLORS.acidicPistachio);
const R = fg256(ANSI_COLORS.starkRose);
const W = fg256(ANSI_COLORS.icySlate);
const D = fg256(ANSI_COLORS.midnightSlate);
const RST = reset();

/**
 * Small prompt-area spider (3 lines).
 * Changes expression based on state.
 */
export function renderSmallSpider(expression: SpiderExpression): string {
  const eyes = getSmallEyes(expression);
  return [
    `${D} /\\${eyes}/\\ ${RST}`,
    `${V}(  ${expression === 'thinking' ? '•' : '◇'}  )${RST}`,
    `${D} \\/\\/\\/\\/ ${RST}`,
  ].join('\n');
}

/**
 * Large welcome screen spider (10 lines).
 * Full geometric spider with web strands.
 */
export function renderLargeSpider(expression: SpiderExpression): string {
  const eyes = getLargeEyes(expression);

  return [
    `${D}      ╱╲          ╱╲      ${RST}`,
    `${D}     ╱  ╲   ╱╲   ╱  ╲     ${RST}`,
    `${D}    ╱    ╲ ╱  ╲ ╱    ╲    ${RST}`,
    `${V}   ╱──────${bold()}(${eyes})${RST}${V}──────╲   ${RST}`,
    `${V}   ╲      ${bold()} ╱╲╲ ${RST}${V}      ╱   ${RST}`,
    `${V}    ╲    ╱ ◇◇ ╲    ╱    ${RST}`,
    `${D}     ╲  ╱  ╱╲  ╲  ╱     ${RST}`,
    `${D}      ╲╱  ╱  ╲  ╲╱      ${RST}`,
    `${D}       ╲ ╱    ╲ ╱       ${RST}`,
    `${D}        ╳      ╳        ${RST}`,
  ].join('\n');
}

function getSmallEyes(expression: SpiderExpression): string {
  switch (expression) {
    case 'idle':
      return `${W}(-  -)${RST}`;
    case 'thinking':
      return `${G}(•  •)${RST}`;
    case 'success':
      return `${G}(^  ^)${RST}`;
    case 'error':
      return `${R}(O  O)${RST}`;
    case 'working':
      return `${V}(>  <)${RST}`;
    case 'greeting':
      return `${G}(◕  ◕)${RST}`;
    case 'confused':
      return `${R}(?  ?)${RST}`;
    default:
      return `${W}(-  -)${RST}`;
  }
}

function getLargeEyes(expression: SpiderExpression): string {
  switch (expression) {
    case 'idle':
      return `${W}─  ─${RST}`;
    case 'thinking':
      return `${G}•  •${RST}`;
    case 'success':
      return `${G}^  ^${RST}`;
    case 'error':
      return `${R}O  O${RST}`;
    case 'working':
      return `${V}>  <${RST}`;
    case 'greeting':
      return `${G}◕  ◕${RST}`;
    case 'confused':
      return `${R}?  ?${RST}`;
    default:
      return `${W}─  ─${RST}`;
  }
}
