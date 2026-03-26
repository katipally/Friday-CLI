import type { SpiderExpression } from '@fridaycode/shared';

// ─── ANSI Helpers ────────────────────────────────────────────
const ESC = '\x1b[';
const RESET = `${ESC}0m`;
const BOLD = `${ESC}1m`;
const DIM = `${ESC}2m`;
const ITALIC = `${ESC}3m`;

function fg(code: number): string { return `${ESC}38;5;${code}m`; }
function bg(code: number): string { return `${ESC}48;5;${code}m`; }
function rgb(r: number, g: number, b: number): string { return `${ESC}38;2;${r};${g};${b}m`; }

// ─── FridayCode Palette ──────────────────────────────────────
const VIOLET = rgb(139, 92, 246);
const VIOLET_LIGHT = rgb(167, 139, 250);
const VIOLET_DARK = rgb(109, 40, 217);
const VIOLET_GLOW = rgb(196, 181, 253);
const ROSE = rgb(244, 63, 94);
const GREEN = rgb(163, 230, 53);
const WHITE = rgb(248, 250, 252);
const SLATE = rgb(100, 116, 139);
const DARK = rgb(51, 65, 85);
const DIM_DARK = rgb(30, 41, 59);
const CYAN = rgb(34, 211, 238);
const AMBER = rgb(251, 191, 36);
const TEAL = rgb(45, 212, 191);
const PINK = rgb(244, 114, 182);

// ─── Spider Eyes ─────────────────────────────────────────────
const EYES: Record<SpiderExpression, { left: string; right: string; color: string }> = {
  idle:     { left: '◉', right: '◉', color: CYAN },
  thinking: { left: '◎', right: '◎', color: VIOLET_GLOW },
  success:  { left: '✦', right: '✦', color: GREEN },
  error:    { left: '⊗', right: '⊗', color: ROSE },
  working:  { left: '◉', right: '◉', color: AMBER },
  greeting: { left: '★', right: '★', color: GREEN },
  confused: { left: '◌', right: '◌', color: ROSE },
};

export function getEyes(expression: SpiderExpression): string {
  const e = EYES[expression];
  return `${e.color}${e.left} ${e.right}${RESET}`;
}

// ─── Welcome Spider (Large — web-sitting spider with silk) ──
export function renderLargeSpider(expression: SpiderExpression = 'greeting'): string {
  const e = EYES[expression];
  const EC = e.color;
  const V = VIOLET;
  const VL = VIOLET_LIGHT;
  const VD = VIOLET_DARK;
  const VG = VIOLET_GLOW;
  const D = DARK;
  const DD = DIM_DARK;
  const S = SLATE;
  const C = CYAN;
  const R = RESET;

  return [
    ``,
    `${DD}              │${R}`,
    `${DD}              │${R}`,
    `${DD}         ┌────┴────┐${R}`,
    `${DD}    ─────┤${R}  ${S}╲╱╲╱${R}  ${DD}├─────${R}`,
    `${DD}         └──┐  ┌──┘${R}`,
    `${VD}    ╲╲       ${R}${BOLD}${VL}┃${R}${EC}${BOLD}${e.left}${R}${VG}${BOLD}▼${R}${EC}${BOLD}${e.right}${R}${BOLD}${VL}┃${R}${VD}       ╱╱${R}`,
    `${VD}     ╲╲      ${VL}╰${V}━━━${VL}╯${R}${VD}      ╱╱${R}`,
    `${V}      ╲╲    ${VL}╱${V}█████${VL}╲${R}${V}    ╱╱${R}`,
    `${V}       ╲╲  ${VL}╱${V}███████${VL}╲${R}${V}  ╱╱${R}`,
    `${VL}        ╲╲${V}╱${VL}─${V}──${VL}─${V}──${VL}─${V}╲${VL}╱╱${R}`,
    `${VL}    ╱╱   ${V}╲${VL}▔▔▔▔▔▔▔${V}╱${R}${VL}   ╲╲${R}`,
    `${VL}   ╱╱     ${V}╲${VL}━━━━━${V}╱${R}${VL}     ╲╲${R}`,
    `${VD}  ╱╱       ${V}╲${VD}───${V}╱${R}${VD}       ╲╲${R}`,
    `${DD} ╱           ${DD}╳${R}${DD}           ╲${R}`,
    `${DD}╱           ╱ ╲           ╲${R}`,
    ``,
  ].join('\n');
}

// ─── Compact Spider (for prompt / inline) ───────────────────
export function renderSmallSpider(expression: SpiderExpression = 'idle'): string {
  const e = EYES[expression];
  const EC = e.color;
  const V = VIOLET;
  const VL = VIOLET_LIGHT;
  const R = RESET;
  return `${V}╲╲${VL}(${EC}${e.left}${e.right}${VL})${V}╱╱${R}`;
}

// ─── Tiny Spider (single-line decoration) ───────────────────
export function renderTinySpider(): string {
  return `${VIOLET}⌽${RESET}`;
}

// ─── Web Strand Decoration ──────────────────────────────────
export function renderWebStrand(width: number = 60): string {
  const D = DARK;
  const DD = DIM_DARK;
  const S = SLATE;
  const R = RESET;
  const mid = Math.floor(width / 2);
  let strand = '';
  for (let i = 0; i < width; i++) {
    if (i === mid) strand += `${S}◇${R}`;
    else if (i % 8 === 0) strand += `${DD}·${R}`;
    else if (i % 4 === 0) strand += `${DD}╌${R}`;
    else strand += `${DD}─${R}`;
  }
  return strand;
}

// ─── Dangling Spider (for loading states) ───────────────────
const DANGLING_FRAMES = [
  (V: string, VL: string, C: string, D: string, R: string) => [
    `${D}  │${R}`,
    `${D}  │${R}`,
    `${V}╲${VL}(${C}◉◉${VL})${V}╱${R}`,
    `${V} ╲${VL}▼${V}╱${R}`,
  ],
  (V: string, VL: string, C: string, D: string, R: string) => [
    `${D}  │${R}`,
    `${D}  ┊${R}`,
    `${V}╲${VL}(${C}◎◎${VL})${V}╱${R}`,
    `${V} ╲${VL}▼${V}╱${R}`,
  ],
  (V: string, VL: string, C: string, D: string, R: string) => [
    `${D}  │${R}`,
    `${D}  │${R}`,
    `${D}  ┊${R}`,
    `${V}╲${VL}(${C}◉◉${VL})${V}╱${R}`,
  ],
  (V: string, VL: string, C: string, D: string, R: string) => [
    `${D}  │${R}`,
    `${D}  ┊${R}`,
    `${V}╲${VL}(${C}◉◉${VL})${V}╱${R}`,
    `${V} ╲${VL}▼${V}╱${R}`,
  ],
];

let danglingIdx = 0;
export function getDanglingFrame(): string {
  const frame = DANGLING_FRAMES[danglingIdx % DANGLING_FRAMES.length];
  danglingIdx++;
  return frame(VIOLET, VIOLET_LIGHT, CYAN, DARK, RESET).join('\n');
}

// ─── Web-Spinning Animation ─────────────────────────────────
const WEB_SPIN_FRAMES = [
  `${DARK}╲${SLATE}·${DARK}╱${RESET}`,
  `${DARK}─${VIOLET_LIGHT}◇${DARK}─${RESET}`,
  `${DARK}╱${SLATE}·${DARK}╲${RESET}`,
  `${DARK}│${VIOLET_LIGHT}◇${DARK}│${RESET}`,
];
let webSpinIdx = 0;
export function getWebSpinFrame(): string {
  const frame = WEB_SPIN_FRAMES[webSpinIdx % WEB_SPIN_FRAMES.length];
  webSpinIdx++;
  return frame;
}

// ─── Thinking Spinner with Verbs ─────────────────────────────
const SPINNER_FRAMES = ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷'];
const THINKING_VERBS = [
  'Weaving', 'Spinning', 'Crawling', 'Building',
  'Analyzing', 'Thinking', 'Processing', 'Scanning',
  'Exploring', 'Searching',
];
const THINKING_TIPS = [
  'Tip: Use @file to reference files',
  'Tip: /compact saves context space',
  'Tip: Ctrl+C to abort',
  'Tip: /model to switch models',
  'Tip: /diff to see changes',
  'Tip: /help for all commands',
];

let spinnerIdx = 0;
let currentVerb = THINKING_VERBS[0];
let verbChangeCounter = 0;
let currentTip = '';
let tipChangeCounter = 0;
let showTips = true;

export function getSpinnerFrame(): string {
  const frame = SPINNER_FRAMES[spinnerIdx % SPINNER_FRAMES.length];
  spinnerIdx++;

  // Change verb every ~20 frames
  verbChangeCounter++;
  if (verbChangeCounter >= 20) {
    verbChangeCounter = 0;
    currentVerb = THINKING_VERBS[Math.floor(Math.random() * THINKING_VERBS.length)];
  }

  // Change tip every ~60 frames
  tipChangeCounter++;
  if (tipChangeCounter >= 60) {
    tipChangeCounter = 0;
    currentTip = showTips ? THINKING_TIPS[Math.floor(Math.random() * THINKING_TIPS.length)] : '';
  }

  const tip = currentTip ? `  ${DARK}${currentTip}${RESET}` : '';
  return `${VIOLET}${frame}${RESET} ${VIOLET_LIGHT}${currentVerb}...${RESET}${tip}`;
}

// ─── Thinking Animation (color-cycling gem) ──────────────────
const THINKING_FRAMES = [
  `${VIOLET}⟡${RESET}`,
  `${VIOLET_LIGHT}⟡${RESET}`,
  `${CYAN}✦${RESET}`,
  `${TEAL}✦${RESET}`,
  `${VIOLET_GLOW}⟡${RESET}`,
  `${VIOLET_LIGHT}✦${RESET}`,
];
let thinkingIdx = 0;

export function getThinkingFrame(): string {
  const f = THINKING_FRAMES[thinkingIdx % THINKING_FRAMES.length];
  thinkingIdx++;
  return f;
}

// ─── Success Celebration ────────────────────────────────────
const CELEBRATE_FRAMES = [
  `${GREEN}✓${RESET} ${VIOLET}⌽${RESET}`,
  `${GREEN}✓${RESET}  ${VIOLET}⌽${RESET}`,
  `${GREEN}✓${RESET} ${GREEN}★${RESET} ${VIOLET}⌽${RESET}`,
  `${GREEN}✓${RESET} ${AMBER}✦${RESET} ${VIOLET}⌽${RESET}`,
];
let celebrateIdx = 0;
export function getCelebrateFrame(): string {
  const f = CELEBRATE_FRAMES[celebrateIdx % CELEBRATE_FRAMES.length];
  celebrateIdx++;
  return f;
}

// ─── Prompt Bar Colors ──────────────────────────────────────
export const PROMPT_BAR_COLORS: Record<string, string> = {
  violet: '#8B5CF6',
  blue: '#3B82F6',
  green: '#22C55E',
  yellow: '#EAB308',
  red: '#EF4444',
  orange: '#F97316',
  pink: '#EC4899',
  cyan: '#06B6D4',
  teal: '#14B8A6',
  purple: '#A855F7',
  indigo: '#6366F1',
  amber: '#F59E0B',
};

let promptBarColor = '#8B5CF6';
export function setPromptBarColor(color: string): boolean {
  if (PROMPT_BAR_COLORS[color]) {
    promptBarColor = PROMPT_BAR_COLORS[color];
    return true;
  }
  // Allow hex colors
  if (/^#[0-9a-fA-F]{6}$/.test(color)) {
    promptBarColor = color;
    return true;
  }
  return false;
}
export function getPromptBarColor(): string {
  return promptBarColor;
}

export function setShowTips(enabled: boolean): void {
  showTips = enabled;
}

export function resetAnimations(): void {
  spinnerIdx = 0;
  thinkingIdx = 0;
  danglingIdx = 0;
  webSpinIdx = 0;
  celebrateIdx = 0;
  verbChangeCounter = 0;
  tipChangeCounter = 0;
  currentVerb = THINKING_VERBS[0];
  currentTip = '';
}
