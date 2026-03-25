import { describe, it, expect, beforeEach } from 'vitest';
import { I18n } from '../i18n.js';

describe('I18n', () => {
  let i18n: I18n;

  beforeEach(() => {
    i18n = new I18n();
  });

  describe('default state', () => {
    it('has default locale of en', () => {
      expect(i18n.getLocale()).toBe('en');
    });

    it('lists en as registered locale', () => {
      expect(i18n.listLocales()).toEqual(['en']);
    });
  });

  describe('t() translation', () => {
    it('returns English translation for known key', () => {
      expect(i18n.t('welcome.title')).toBe('Friday CLI');
    });

    it('returns subtitle translation', () => {
      expect(i18n.t('welcome.subtitle')).toBe('AI-powered coding agent');
    });

    it('returns key for unknown translation', () => {
      expect(i18n.t('nonexistent.key')).toBe('nonexistent.key');
    });

    it('interpolates single param correctly', () => {
      const result = i18n.t('welcome.version', { version: '1.0.0' });
      expect(result).toBe('Version 1.0.0');
    });

    it('interpolates multiple params correctly', () => {
      const result = i18n.t('cost.tokens', { input: '500', output: '200' });
      expect(result).toBe('500 input / 200 output tokens');
    });

    it('interpolates tool param', () => {
      const result = i18n.t('prompt.acting', { tool: 'bash' });
      expect(result).toBe('Running tool: bash');
    });

    it('leaves unreferenced params untouched', () => {
      const result = i18n.t('welcome.title', { unused: 'val' });
      expect(result).toBe('Friday CLI');
    });

    it('returns key with params for unknown key', () => {
      const result = i18n.t('unknown.key', { foo: 'bar' });
      expect(result).toBe('unknown.key');
    });
  });

  describe('register()', () => {
    it('adds new locale', () => {
      i18n.register('es', { 'welcome.title': 'Friday CLI (ES)' });
      expect(i18n.listLocales()).toContain('es');
    });

    it('merges translations for existing locale', () => {
      i18n.register('en', { 'custom.key': 'Custom value' });
      expect(i18n.t('custom.key')).toBe('Custom value');
      // Original translations still work
      expect(i18n.t('welcome.title')).toBe('Friday CLI');
    });

    it('allows registering multiple locales', () => {
      i18n.register('es', { 'welcome.title': 'Friday CLI (ES)' });
      i18n.register('fr', { 'welcome.title': 'Friday CLI (FR)' });
      const locales = i18n.listLocales();
      expect(locales).toContain('en');
      expect(locales).toContain('es');
      expect(locales).toContain('fr');
    });
  });

  describe('setLocale()', () => {
    it('switches locale', () => {
      i18n.register('es', { 'welcome.title': 'Viernes CLI' });
      i18n.setLocale('es');
      expect(i18n.getLocale()).toBe('es');
    });

    it('uses translations from new locale', () => {
      i18n.register('es', { 'welcome.title': 'Viernes CLI' });
      i18n.setLocale('es');
      expect(i18n.t('welcome.title')).toBe('Viernes CLI');
    });

    it('throws error for unregistered locale', () => {
      expect(() => i18n.setLocale('xx')).toThrow('Locale "xx" has no registered translations');
    });

    it('returns key for missing translation in new locale', () => {
      i18n.register('es', { 'welcome.title': 'Viernes CLI' });
      i18n.setLocale('es');
      expect(i18n.t('welcome.subtitle')).toBe('welcome.subtitle');
    });
  });

  describe('listLocales()', () => {
    it('returns registered locales', () => {
      expect(i18n.listLocales()).toEqual(['en']);
    });

    it('includes newly registered locales', () => {
      i18n.register('de', { 'welcome.title': 'Friday CLI (DE)' });
      expect(i18n.listLocales()).toContain('de');
    });
  });

  describe('constructor with custom locale', () => {
    it('sets custom default locale', () => {
      const custom = new I18n('fr');
      expect(custom.getLocale()).toBe('fr');
    });

    it('still registers en translations when custom locale used', () => {
      const custom = new I18n('en');
      expect(custom.t('welcome.title')).toBe('Friday CLI');
    });
  });
});
