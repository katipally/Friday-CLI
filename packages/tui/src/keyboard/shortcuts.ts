export interface KeyBinding {
  key: string;
  action: string;
  description: string;
  category: 'navigation' | 'editing' | 'session' | 'general';
  enabled?: boolean;
}

export interface ShortcutManager {
  register(binding: KeyBinding): void;
  unregister(action: string): void;
  getBindings(): KeyBinding[];
  getByCategory(category: KeyBinding['category']): KeyBinding[];
  findByKey(key: string): KeyBinding | undefined;
  toHelpText(): string;
}

const DEFAULT_SHORTCUTS: KeyBinding[] = [
  { key: 'ctrl+c', action: 'cancel-exit', description: 'Cancel/exit', category: 'general', enabled: true },
  { key: 'ctrl+l', action: 'clear-screen', description: 'Clear screen', category: 'general', enabled: true },
  { key: 'ctrl+n', action: 'new-session', description: 'New session', category: 'session', enabled: true },
  { key: 'ctrl+r', action: 'rewind-undo', description: 'Rewind/undo last', category: 'session', enabled: true },
  { key: 'escape', action: 'cancel-operation', description: 'Cancel current operation', category: 'general', enabled: true },
  { key: 'tab', action: 'autocomplete', description: 'Autocomplete', category: 'editing', enabled: true },
  { key: 'ctrl+k', action: 'toggle-compact', description: 'Toggle compact mode', category: 'general', enabled: true },
  { key: 'ctrl+t', action: 'cycle-theme', description: 'Cycle theme', category: 'general', enabled: true },
  { key: 'ctrl+/', action: 'show-shortcuts', description: 'Show shortcuts help', category: 'general', enabled: true },
  { key: 'up', action: 'history-prev', description: 'Previous history', category: 'navigation', enabled: true },
  { key: 'down', action: 'history-next', description: 'Next history', category: 'navigation', enabled: true },
];

const CATEGORY_ORDER: KeyBinding['category'][] = ['navigation', 'editing', 'session', 'general'];

const CATEGORY_LABELS: Record<KeyBinding['category'], string> = {
  navigation: 'Navigation',
  editing: 'Editing',
  session: 'Session',
  general: 'General',
};

function formatKeyForDisplay(key: string): string {
  return key
    .split('+')
    .map((part) => {
      if (part === 'ctrl') return '^';
      if (part === 'escape') return 'Esc';
      if (part === 'tab') return 'Tab';
      if (part === 'up') return '↑';
      if (part === 'down') return '↓';
      return part.toUpperCase();
    })
    .join('');
}

export function createShortcutManager(): ShortcutManager {
  const bindings = new Map<string, KeyBinding>();

  for (const binding of DEFAULT_SHORTCUTS) {
    bindings.set(binding.action, { ...binding });
  }

  return {
    register(binding: KeyBinding): void {
      bindings.set(binding.action, { enabled: true, ...binding });
    },

    unregister(action: string): void {
      bindings.delete(action);
    },

    getBindings(): KeyBinding[] {
      return [...bindings.values()];
    },

    getByCategory(category: KeyBinding['category']): KeyBinding[] {
      return [...bindings.values()].filter((b) => b.category === category);
    },

    findByKey(key: string): KeyBinding | undefined {
      return [...bindings.values()].find((b) => b.key === key && b.enabled !== false);
    },

    toHelpText(): string {
      const lines: string[] = ['Keyboard Shortcuts', '═'.repeat(40), ''];

      for (const category of CATEGORY_ORDER) {
        const categoryBindings = [...bindings.values()].filter((b) => b.category === category);
        if (categoryBindings.length === 0) continue;

        lines.push(`  ${CATEGORY_LABELS[category]}`);
        lines.push(`  ${'─'.repeat(36)}`);

        for (const binding of categoryBindings) {
          const keyDisplay = formatKeyForDisplay(binding.key).padEnd(12);
          const status = binding.enabled === false ? ' (disabled)' : '';
          lines.push(`  ${keyDisplay} ${binding.description}${status}`);
        }

        lines.push('');
      }

      return lines.join('\n');
    },
  };
}

export { DEFAULT_SHORTCUTS, CATEGORY_ORDER, CATEGORY_LABELS, formatKeyForDisplay };
