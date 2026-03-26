import type { SpiderExpression } from '@fridaycode/shared';
import { ANSI_COLORS } from '@fridaycode/shared';

/**
 * Animation frame generators for the spider mascot.
 */

const V = `\x1b[38;5;${ANSI_COLORS.deepViolet}m`;
const G = `\x1b[38;5;${ANSI_COLORS.acidicPistachio}m`;
const D = `\x1b[38;5;${ANSI_COLORS.midnightSlate}m`;
const RST = '\x1b[0m';

// ─── Blinking Animation ─────────────────────────────────────

const BLINK_FRAMES = [
  { eyes: '─  ─', duration: 3000 },
  { eyes: '_  _', duration: 150 },
  { eyes: '─  ─', duration: 2000 },
  { eyes: '_  _', duration: 150 },
];

let blinkFrameIndex = 0;

export function getNextBlinkFrame(): { eyes: string; duration: number } {
  const frame = BLINK_FRAMES[blinkFrameIndex % BLINK_FRAMES.length];
  blinkFrameIndex++;
  return frame;
}

// ─── Thinking (Web-Spinning) Animation ───────────────────────

const THINKING_FRAMES = [
  `${D}  ╱${V}•${D}╲  ${RST}`,
  `${D}  ╲${V}•${D}╱  ${RST}`,
  `${D}  ─${V}•${D}─  ${RST}`,
  `${D}  ╲${V}•${D}╱  ${RST}`,
];

let thinkingFrameIndex = 0;

export function getNextThinkingFrame(): string {
  const frame = THINKING_FRAMES[thinkingFrameIndex % THINKING_FRAMES.length];
  thinkingFrameIndex++;
  return frame;
}

// ─── Loading (Crawling) Animation ────────────────────────────

const CRAWLING_FRAMES = [
  `${V}/╲${G}(• •)${V}/╲${RST}  `,
  ` ${V}/╲${G}(• •)${V}/╲${RST} `,
  `  ${V}/╲${G}(• •)${V}/╲${RST}`,
  ` ${V}/╲${G}(• •)${V}/╲${RST} `,
];

let crawlingFrameIndex = 0;

export function getNextCrawlingFrame(): string {
  const frame = CRAWLING_FRAMES[crawlingFrameIndex % CRAWLING_FRAMES.length];
  crawlingFrameIndex++;
  return frame;
}

// ─── Spinner ─────────────────────────────────────────────────

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
let spinnerIndex = 0;

export function getNextSpinnerFrame(): string {
  const frame = SPINNER_FRAMES[spinnerIndex % SPINNER_FRAMES.length];
  spinnerIndex++;
  return `${V}${frame}${RST}`;
}

/**
 * Reset all animation state.
 */
export function resetAnimations(): void {
  blinkFrameIndex = 0;
  thinkingFrameIndex = 0;
  crawlingFrameIndex = 0;
  spinnerIndex = 0;
}
