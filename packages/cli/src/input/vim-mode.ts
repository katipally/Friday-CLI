/**
 * Vim mode state machine for terminal input.
 */

export type VimMode = 'normal' | 'insert' | 'visual';

export interface VimState {
  mode: VimMode;
  cursor: number;
  buffer: string;
  register: string;
  visualStart?: number;
}

export function createVimState(initialBuffer: string = ''): VimState {
  return {
    mode: 'insert',
    cursor: initialBuffer.length,
    buffer: initialBuffer,
    register: '',
  };
}

export interface VimAction {
  state: VimState;
  submit?: boolean;
}

/**
 * Process a keypress in vim mode.
 */
export function processVimKey(
  state: VimState,
  char: string,
  key: { escape?: boolean; return?: boolean; backspace?: boolean; delete?: boolean },
): VimAction {
  const s = { ...state };

  if (s.mode === 'insert') {
    return processInsertMode(s, char, key);
  }

  if (s.mode === 'normal') {
    return processNormalMode(s, char, key);
  }

  return { state: s };
}

function processInsertMode(s: VimState, char: string, key: Record<string, boolean | undefined>): VimAction {
  if (key.escape) {
    s.mode = 'normal';
    s.cursor = Math.max(0, s.cursor - 1);
    return { state: s };
  }

  if (key.return) {
    return { state: s, submit: true };
  }

  if (key.backspace || key.delete) {
    if (s.cursor > 0) {
      s.buffer = s.buffer.slice(0, s.cursor - 1) + s.buffer.slice(s.cursor);
      s.cursor--;
    }
    return { state: s };
  }

  if (char) {
    s.buffer = s.buffer.slice(0, s.cursor) + char + s.buffer.slice(s.cursor);
    s.cursor++;
  }

  return { state: s };
}

function processNormalMode(s: VimState, char: string, key: Record<string, boolean | undefined>): VimAction {
  if (key.return) {
    return { state: s, submit: true };
  }

  switch (char) {
    // Enter insert
    case 'i':
      s.mode = 'insert';
      break;
    case 'a':
      s.mode = 'insert';
      s.cursor = Math.min(s.cursor + 1, s.buffer.length);
      break;
    case 'A':
      s.mode = 'insert';
      s.cursor = s.buffer.length;
      break;
    case 'I':
      s.mode = 'insert';
      s.cursor = 0;
      break;
    case 'o':
      s.mode = 'insert';
      s.buffer += '\n';
      s.cursor = s.buffer.length;
      break;

    // Movement
    case 'h':
      s.cursor = Math.max(0, s.cursor - 1);
      break;
    case 'l':
      s.cursor = Math.min(s.buffer.length - 1, s.cursor + 1);
      break;
    case '0':
      s.cursor = 0;
      break;
    case '$':
      s.cursor = Math.max(0, s.buffer.length - 1);
      break;
    case 'w': {
      // Next word
      const nextSpace = s.buffer.indexOf(' ', s.cursor + 1);
      s.cursor = nextSpace >= 0 ? nextSpace + 1 : s.buffer.length - 1;
      break;
    }
    case 'b': {
      // Previous word
      const prevSpace = s.buffer.lastIndexOf(' ', s.cursor - 2);
      s.cursor = prevSpace >= 0 ? prevSpace + 1 : 0;
      break;
    }

    // Delete
    case 'x':
      if (s.cursor < s.buffer.length) {
        s.register = s.buffer[s.cursor];
        s.buffer = s.buffer.slice(0, s.cursor) + s.buffer.slice(s.cursor + 1);
        s.cursor = Math.min(s.cursor, Math.max(0, s.buffer.length - 1));
      }
      break;

    // Paste
    case 'p':
      if (s.register) {
        s.buffer = s.buffer.slice(0, s.cursor + 1) + s.register + s.buffer.slice(s.cursor + 1);
        s.cursor += s.register.length;
      }
      break;

    // Clear line
    case 'S':
      s.register = s.buffer;
      s.buffer = '';
      s.cursor = 0;
      s.mode = 'insert';
      break;
  }

  return { state: s };
}
