import type { SpiderExpression } from '@fridaycode/shared';

/**
 * Animation frame generators for the spider mascot.
 * Rich animations with web-spinning, crawling, dangling, and blinking.
 */

// RGB color helpers
function rgb(r: number, g: number, b: number): string { return `\x1b[38;2;${r};${g};${b}m`; }
const V = rgb(139, 92, 246);
const VL = rgb(167, 139, 250);
const VG = rgb(196, 181, 253);
const G = rgb(163, 230, 53);
const C = rgb(34, 211, 238);
const A = rgb(251, 191, 36);
const D = rgb(51, 65, 85);
const DD = rgb(30, 41, 59);
const S = rgb(100, 116, 139);
const RST = '\x1b[0m';

// ─── Blinking Animation ─────────────────────────────────────

const BLINK_FRAMES = [
  { eyes: `${C}◉◉${RST}`, duration: 3000 },
  { eyes: `${S}──${RST}`, duration: 150 },
  { eyes: `${C}◉◉${RST}`, duration: 2000 },
  { eyes: `${S}──${RST}`, duration: 150 },
  { eyes: `${C}◉◉${RST}`, duration: 1500 },
  { eyes: `${VL}◎◎${RST}`, duration: 200 },  // curious look
];

let blinkFrameIndex = 0;

export function getNextBlinkFrame(): { eyes: string; duration: number } {
  const frame = BLINK_FRAMES[blinkFrameIndex % BLINK_FRAMES.length];
  blinkFrameIndex++;
  return frame;
}

// ─── Thinking (Web-Spinning) Animation ───────────────────────

const THINKING_FRAMES = [
  `${DD}  ╲${VL}·${DD}╱  ${RST}`,
  `${DD}  ─${VG}◇${DD}─  ${RST}`,
  `${DD}  ╱${VL}·${DD}╲  ${RST}`,
  `${DD}  │${VG}◇${DD}│  ${RST}`,
  `${DD}  ╲${C}✦${DD}╱  ${RST}`,
  `${DD}  ─${VL}·${DD}─  ${RST}`,
  `${DD}  ╱${C}✦${DD}╲  ${RST}`,
  `${DD}  │${VL}·${DD}│  ${RST}`,
];

let thinkingFrameIndex = 0;

export function getNextThinkingFrame(): string {
  const frame = THINKING_FRAMES[thinkingFrameIndex % THINKING_FRAMES.length];
  thinkingFrameIndex++;
  return frame;
}

// ─── Loading (Crawling) Animation ────────────────────────────

const CRAWLING_FRAMES = [
  `${V}╲╲${VL}(${C}◉◉${VL})${V}╱╱${RST}     `,
  ` ${V}╲╲${VL}(${C}◉◉${VL})${V}╱╱${RST}    `,
  `  ${V}╲╲${VL}(${A}◉◉${VL})${V}╱╱${RST}   `,
  `   ${V}╲╲${VL}(${C}◉◉${VL})${V}╱╱${RST}  `,
  `    ${V}╲╲${VL}(${A}◉◉${VL})${V}╱╱${RST} `,
  `   ${V}╲╲${VL}(${C}◉◉${VL})${V}╱╱${RST}  `,
  `  ${V}╲╲${VL}(${A}◉◉${VL})${V}╱╱${RST}   `,
  ` ${V}╲╲${VL}(${C}◉◉${VL})${V}╱╱${RST}    `,
];

let crawlingFrameIndex = 0;

export function getNextCrawlingFrame(): string {
  const frame = CRAWLING_FRAMES[crawlingFrameIndex % CRAWLING_FRAMES.length];
  crawlingFrameIndex++;
  return frame;
}

// ─── Dangling Spider (dropping from silk) ────────────────────

const DANGLING_FRAMES = [
  [`${DD}│${RST}`, `${DD}│${RST}`, `${V}╲╲${VL}(${C}◉◉${VL})${V}╱╱${RST}`],
  [`${DD}│${RST}`, `${DD}┊${RST}`, `${V}╲╲${VL}(${VG}◎◎${VL})${V}╱╱${RST}`],
  [`${DD}│${RST}`, `${DD}│${RST}`, `${DD}┊${RST}`, `${V}╲╲${VL}(${C}◉◉${VL})${V}╱╱${RST}`],
  [`${DD}│${RST}`, `${DD}┊${RST}`, `${V}╲╲${VL}(${C}◉◉${VL})${V}╱╱${RST}`],
];

let danglingFrameIndex = 0;

export function getNextDanglingFrame(): string {
  const frame = DANGLING_FRAMES[danglingFrameIndex % DANGLING_FRAMES.length];
  danglingFrameIndex++;
  return frame.join('\n');
}

// ─── Success Celebration ─────────────────────────────────────

const CELEBRATE_FRAMES = [
  `${G}✓${RST} ${V}⌽${RST}`,
  `${G}✓${RST}  ${V}⌽${RST} ${A}✦${RST}`,
  `${G}✓${RST} ${G}★${RST} ${V}⌽${RST}`,
  `${G}✓${RST} ${A}✦${RST} ${V}⌽${RST} ${G}★${RST}`,
];

let celebrateFrameIndex = 0;

export function getNextCelebrateFrame(): string {
  const frame = CELEBRATE_FRAMES[celebrateFrameIndex % CELEBRATE_FRAMES.length];
  celebrateFrameIndex++;
  return frame;
}

// ─── Spinner ─────────────────────────────────────────────────

const SPINNER_FRAMES = ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷'];
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
  danglingFrameIndex = 0;
  celebrateFrameIndex = 0;
  spinnerIndex = 0;
}
