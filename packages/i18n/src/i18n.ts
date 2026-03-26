type Translations = Record<string, string>;

const EN_TRANSLATIONS: Translations = {
  'welcome.title': 'fridaycode',
  'welcome.subtitle': 'AI-powered coding agent',
  'welcome.version': 'Version {version}',
  'prompt.input': 'You: ',
  'prompt.thinking': 'Thinking...',
  'prompt.acting': 'Running tool: {tool}',
  'error.provider_not_found': 'Provider "{provider}" not found',
  'error.model_not_found': 'Model "{model}" not found',
  'error.api_key_missing': 'API key missing for {provider}',
  'error.budget_exceeded': 'Budget exceeded: ${cost} / ${budget}',
  'cost.session_total': 'Session cost: ${cost}',
  'cost.tokens': '{input} input / {output} output tokens',
  'permission.prompt': 'Allow {tool} on {target}?',
  'permission.denied': 'Permission denied for {tool}',
  'command.help': 'Show help',
  'command.model': 'Switch model',
  'command.mode': 'Switch mode',
  'command.clear': 'Clear history',
  'command.exit': 'Exit Friday',
};

export class I18n {
  private locale: string = 'en';
  private translations: Map<string, Translations> = new Map();

  constructor(defaultLocale?: string) {
    this.locale = defaultLocale || 'en';
    this.register('en', EN_TRANSLATIONS);
  }

  register(locale: string, translations: Translations): void {
    const existing = this.translations.get(locale) || {};
    this.translations.set(locale, { ...existing, ...translations });
  }

  setLocale(locale: string): void {
    if (!this.translations.has(locale)) {
      throw new Error(`Locale "${locale}" has no registered translations`);
    }
    this.locale = locale;
  }

  getLocale(): string {
    return this.locale;
  }

  t(key: string, params?: Record<string, string>): string {
    const dict = this.translations.get(this.locale);
    let value = dict?.[key] ?? key;

    if (params) {
      for (const [param, replacement] of Object.entries(params)) {
        value = value.replaceAll(`{${param}}`, replacement);
      }
    }

    return value;
  }

  listLocales(): string[] {
    return Array.from(this.translations.keys());
  }
}
