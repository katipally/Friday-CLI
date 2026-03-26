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

function rgb(r: number, g: number, b: number): string {
  return `\x1b[38;2;${r};${g};${b}m`;
}

const V = rgb(139, 92, 246);
const VL = rgb(167, 139, 250);
const VD = rgb(109, 40, 217);
const VG = rgb(196, 181, 253);
const G = rgb(163, 230, 53);
const R = fg256(ANSI_COLORS.starkRose);
const W = fg256(ANSI_COLORS.icySlate);
const D = rgb(51, 65, 85);
const DD = rgb(30, 41, 59);
const S = rgb(100, 116, 139);
const C = rgb(34, 211, 238);
const A = rgb(251, 191, 36);
const RST = reset();

/**
 * Small prompt-area spider.
 * Changes expression based on state.
 */
export function renderSmallSpider(expression: SpiderExpression): string {
  const eyes = getSmallEyes(expression);
  return `${V}╲╲${eyes}${V}╱╱${RST}`;
}

/**
 * Large welcome screen spider with silk thread and web.
 */
export function renderLargeSpider(expression: SpiderExpression): string {
  const eyes = getLargeEyes(expression);

  return [
    `${DD}              │${RST}`,
    `${DD}              │${RST}`,
    `${DD}         ┌────┴────┐${RST}`,
    `${DD}    ─────┤${RST}  ${S}╲╱╲╱${RST}  ${DD}├─────${RST}`,
    `${DD}         └──┐  ┌──┘${RST}`,
    `${VD}    ╲╲       ${bold()}${VL}┃${RST}${eyes}${VG}${bold()}▼${RST}${eyes}${bold()}${VL}┃${RST}${VD}       ╱╱${RST}`,
    `${VD}     ╲╲      ${VL}╰${V}━━━${VL}╯${RST}${VD}      ╱╱${RST}`,
    `${V}      ╲╲    ${VL}╱${V}█████${VL}╲${RST}${V}    ╱╱${RST}`,
    `${V}       ╲╲  ${VL}╱${V}███████${VL}╲${RST}${V}  ╱╱${RST}`,
    `${VL}        ╲╲${V}╱${VL}─${V}──${VL}─${V}──${VL}─${V}╲${VL}╱╱${RST}`,
    `${VL}    ╱╱   ${V}╲${VL}▔▔▔▔▔▔▔${V}╱${RST}${VL}   ╲╲${RST}`,
    `${VL}   ╱╱     ${V}╲${VL}━━━━━${V}╱${RST}${VL}     ╲╲${RST}`,
    `${VD}  ╱╱       ${V}╲${VD}───${V}╱${RST}${VD}       ╲╲${RST}`,
    `${DD} ╱           ${DD}╳${RST}${DD}           ╲${RST}`,
  ].join('\n');
}

function getSmallEyes(expression: SpiderExpression): string {
  switch (expression) {
    case 'idle':
      return `${VL}(${C}◉◉${VL})${RST}`;
    case 'thinking':
      return `${VL}(${VG}◎◎${VL})${RST}`;
    case 'success':
      return `${VL}(${G}✦✦${VL})${RST}`;
    case 'error':
      return `${VL}(${R}⊗⊗${VL})${RST}`;
    case 'working':
      return `${VL}(${A}◉◉${VL})${RST}`;
    case 'greeting':
      return `${VL}(${G}★★${VL})${RST}`;
    case 'confused':
      return `${VL}(${R}◌◌${VL})${RST}`;
    default:
      return `${VL}(${C}◉◉${VL})${RST}`;
  }
}

function getLargeEyes(expression: SpiderExpression): string {
  switch (expression) {
    case 'idle':
      return `${C}◉ ◉${RST}`;
    case 'thinking':
      return `${VG}◎ ◎${RST}`;
    case 'success':
      return `${G}✦ ✦${RST}`;
    case 'error':
      return `${R}⊗ ⊗${RST}`;
    case 'working':
      return `${A}◉ ◉${RST}`;
    case 'greeting':
      return `${G}★ ★${RST}`;
    case 'confused':
      return `${R}◌ ◌${RST}`;
    default:
      return `${C}◉ ◉${RST}`;
  }
}
