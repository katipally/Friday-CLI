import type { SpiderExpression } from '@fridaycode/shared';

// ─── ANSI Helpers ────────────────────────────────────────────
const ESC = '\x1b[';
const RESET = `${ESC}0m`;
const BOLD = `${ESC}1m`;
const DIM = `${ESC}2m`;
const ITALIC = `${ESC}3m`;

// 256-color foreground
function fg(code: number): string { return `${ESC}38;5;${code}m`; }
// 256-color background
function bg(code: number): string { return `${ESC}48;5;${code}m`; }
// RGB foreground
function rgb(r: number, g: number, b: number): string { return `${ESC}38;2;${r};${g};${b}m`; }

// ─── FridayCode Palette ──────────────────────────────────────
const VIOLET = rgb(139, 92, 246);      // #8B5CF6 — brand primary
const VIOLET_LIGHT = rgb(167, 139, 250); // lighter violet
const VIOLET_DARK = rgb(109, 40, 217);  // deeper violet
const ROSE = rgb(244, 63, 94);          // #F43F5E — errors/warnings
const GREEN = rgb(163, 230, 53);        // #A3E635 — success
const WHITE = rgb(248, 250, 252);       // #F8FAFC — text
const SLATE = rgb(100, 116, 139);       // muted text
const DARK = rgb(51, 65, 85);           // borders/dim
const CYAN = rgb(34, 211, 238);         // accent cyan
const AMBER = rgb(251, 191, 36);        // accent warm

// ─── Spider Eyes ─────────────────────────────────────────────
const EYES: Record<SpiderExpression, { left: string; right: string; color: string }> = {
  idle:     { left: '●', right: '●', color: CYAN },
  thinking: { left: '◉', right: '◉', color: VIOLET_LIGHT },
  success:  { left: '◕', right: '◕', color: GREEN },
  error:    { left: '◎', right: '◎', color: ROSE },
  working:  { left: '◉', right: '◉', color: AMBER },
  greeting: { left: '◕', right: '◕', color: GREEN },
  confused: { left: '◔', right: '◔', color: ROSE },
};

export function getEyes(expression: SpiderExpression): string {
  const e = EYES[expression];
  return `${e.color}${e.left} ${e.right}${RESET}`;
}

// ─── Welcome Spider (Large) ─────────────────────────────────
export function renderLargeSpider(expression: SpiderExpression = 'greeting'): string {
  const e = EYES[expression];
  const EC = e.color;  // eye color
  const V = VIOLET;
  const VL = VIOLET_LIGHT;
  const VD = VIOLET_DARK;
  const D = DARK;
  const S = SLATE;
  const R = RESET;

  // A detailed geometric spider with web, colored legs, and expressive eyes
  return [
    ``,
    `${D}          ╲${S}·${D}╱     ${S}·${D}     ╲${S}·${D}╱${R}`,
    `${D}           ╲${S}·${D}╱   ${S}·${D}   ╲${S}·${D}╱${R}`,
    `${VD}      ╱╲${D}    ╲${S}·${D}╱ ${S}·${D} ╲${S}·${D}╱    ${VD}╱╲${R}`,
    `${VD}     ╱  ╲${D}    ╲ ╱    ${VD}╱  ╲${R}`,
    `${V}    ╱    ╲${D}   ${BOLD}${VL}(${R}${EC}${BOLD}${e.left}  ${e.right}${R}${BOLD}${VL})${R}${D}   ${V}╱    ╲${R}`,
    `${V}   ╱      ╲${D}   ${VL}╲${V}▼▼${VL}╱${D}   ${V}╱      ╲${R}`,
    `${VL}  ╱   ${V}╱╲   ${VL}╲  ${D}╱╲  ${VL}╱   ${V}╱╲   ${VL}╲${R}`,
    `${VL} ╱   ${V}╱  ╲   ${VL}╲${D}╱  ╲${VL}╱   ${V}╱  ╲   ${VL}╲${R}`,
    `${VD}╱   ╱    ╲   ${D}╲╱   ${VD}╱    ╲   ╲${R}`,
    `${D}    ╱      ╲       ╱      ╲${R}`,
    ``,
  ].join('\n');
}

// ─── Prompt Spider (Small, Compact) ─────────────────────────
export function renderSmallSpider(expression: SpiderExpression = 'idle'): string {
  const e = EYES[expression];
  const EC = e.color;
  const V = VIOLET;
  const VL = VIOLET_LIGHT;
  const R = RESET;
  return `${V}/\\${EC}(${e.left}${e.right})${V}/\\${R}`;
}

// ─── Thinking Spinner Frames ─────────────────────────────────
const SPINNER_CHARS = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
let spinnerIdx = 0;

export function getSpinnerFrame(): string {
  const frame = SPINNER_CHARS[spinnerIdx % SPINNER_CHARS.length];
  spinnerIdx++;
  return `${VIOLET}${frame}${RESET}`;
}

// ─── Thinking Animation Frames ──────────────────────────────
const THINKING_FRAMES = [
  `${VIOLET}⟡${RESET}`,
  `${VIOLET_LIGHT}⟡${RESET}`,
  `${CYAN}⟡${RESET}`,
  `${VIOLET_LIGHT}⟡${RESET}`,
];
let thinkingIdx = 0;

export function getThinkingFrame(): string {
  const f = THINKING_FRAMES[thinkingIdx % THINKING_FRAMES.length];
  thinkingIdx++;
  return f;
}

export function resetAnimations(): void {
  spinnerIdx = 0;
  thinkingIdx = 0;
}
