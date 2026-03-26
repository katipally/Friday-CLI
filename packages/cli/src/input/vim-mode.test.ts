import { describe, it, expect } from 'vitest';
import { createVimState, processVimKey } from './vim-mode.js';

const noKey = {};
const escape = { escape: true };
const enter = { return: true };
const backspace = { backspace: true };

describe('vim-mode', () => {
  it('starts in insert mode', () => {
    const state = createVimState();
    expect(state.mode).toBe('insert');
    expect(state.buffer).toBe('');
    expect(state.cursor).toBe(0);
  });

  it('types characters in insert mode', () => {
    let state = createVimState();
    ({ state } = processVimKey(state, 'h', noKey));
    ({ state } = processVimKey(state, 'i', noKey));
    expect(state.buffer).toBe('hi');
    expect(state.cursor).toBe(2);
  });

  it('handles backspace in insert mode', () => {
    let state = createVimState('abc');
    ({ state } = processVimKey(state, '', backspace));
    expect(state.buffer).toBe('ab');
    expect(state.cursor).toBe(2);
  });

  it('submits on Enter in insert mode', () => {
    const state = createVimState('hello');
    const result = processVimKey(state, '', enter);
    expect(result.submit).toBe(true);
  });

  it('switches to normal mode on Escape', () => {
    let state = createVimState('abc');
    ({ state } = processVimKey(state, '', escape));
    expect(state.mode).toBe('normal');
  });

  it('enters insert mode with i', () => {
    let state = createVimState('abc');
    state.mode = 'normal';
    state.cursor = 1;
    ({ state } = processVimKey(state, 'i', noKey));
    expect(state.mode).toBe('insert');
    expect(state.cursor).toBe(1);
  });

  it('enters insert mode at end with A', () => {
    let state = createVimState('abc');
    state.mode = 'normal';
    state.cursor = 0;
    ({ state } = processVimKey(state, 'A', noKey));
    expect(state.mode).toBe('insert');
    expect(state.cursor).toBe(3);
  });

  it('moves cursor with h/l in normal mode', () => {
    let state = createVimState('abcde');
    state.mode = 'normal';
    state.cursor = 2;
    ({ state } = processVimKey(state, 'h', noKey));
    expect(state.cursor).toBe(1);
    ({ state } = processVimKey(state, 'l', noKey));
    expect(state.cursor).toBe(2);
  });

  it('jumps to start/end with 0/$', () => {
    let state = createVimState('abcde');
    state.mode = 'normal';
    state.cursor = 2;
    ({ state } = processVimKey(state, '0', noKey));
    expect(state.cursor).toBe(0);
    ({ state } = processVimKey(state, '$', noKey));
    expect(state.cursor).toBe(4);
  });

  it('deletes char with x', () => {
    let state = createVimState('abcde');
    state.mode = 'normal';
    state.cursor = 2;
    ({ state } = processVimKey(state, 'x', noKey));
    expect(state.buffer).toBe('abde');
    expect(state.register).toBe('c');
  });

  it('pastes register with p', () => {
    let state = createVimState('abde');
    state.mode = 'normal';
    state.cursor = 1;
    state.register = 'c';
    ({ state } = processVimKey(state, 'p', noKey));
    expect(state.buffer).toBe('abcde');
  });
});
