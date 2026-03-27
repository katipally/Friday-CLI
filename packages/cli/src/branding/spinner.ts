/**
 * FridayCode spinner and prompt bar color system.
 * Replaces the spider-based spinner with clean braille animation.
 */

// ─── Spinner ─────────────────────────────────────────────────
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const THINKING_VERBS = [
  'Thinking', 'Analyzing', 'Searching', 'Processing',
  'Scanning', 'Exploring', 'Building', 'Reading',
  'Writing', 'Reasoning',
];

let spinnerIdx = 0;
let currentVerb = THINKING_VERBS[0];
let verbChangeCounter = 0;

export function getSpinnerFrame(): string {
  const frame = SPINNER_FRAMES[spinnerIdx % SPINNER_FRAMES.length];
  spinnerIdx++;

  // Change verb every ~20 frames
  verbChangeCounter++;
  if (verbChangeCounter >= 20) {
    verbChangeCounter = 0;
    currentVerb = THINKING_VERBS[Math.floor(Math.random() * THINKING_VERBS.length)];
  }

  return `${frame} ${currentVerb}...`;
}

export function resetSpinner(): void {
  spinnerIdx = 0;
  verbChangeCounter = 0;
  currentVerb = THINKING_VERBS[0];
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
  if (/^#[0-9a-fA-F]{6}$/.test(color)) {
    promptBarColor = color;
    return true;
  }
  return false;
}

export function getPromptBarColor(): string {
  return promptBarColor;
}

// ─── Separator ──────────────────────────────────────────────
export function renderSeparator(width: number = 60): string {
  return '─'.repeat(width);
}
