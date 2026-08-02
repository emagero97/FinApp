import { TestBed } from '@angular/core/testing';
import { SettingsService } from './settings.service';

describe('SettingsService', () => {
  afterEach(() => {
    try {
      window.localStorage.clear();
    } catch {
      // ignore
    }
    window.document.documentElement.removeAttribute('data-theme');
    window.document.documentElement.removeAttribute('lang');
  });

  it('defaults to dark theme and english', () => {
    const service = TestBed.inject(SettingsService);
    expect(service.theme()).toBe('dark');
    expect(service.language()).toBe('en');
  });

  it('toggles theme', () => {
    const service = TestBed.inject(SettingsService);
    service.toggleTheme();
    expect(service.theme()).toBe('light');
    service.toggleTheme();
    expect(service.theme()).toBe('dark');
  });

  it('toggles language and translates strings', () => {
    const service = TestBed.inject(SettingsService);
    expect(service.t('tx.add')).toBe('Add');
    service.toggleLanguage();
    expect(service.language()).toBe('it');
    expect(service.t('tx.add')).toBe('Aggiungi');
  });
});