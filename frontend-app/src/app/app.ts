import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SettingsService } from './services/settings.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  sidebarCollapsed = signal(false);
  readonly settings = inject(SettingsService);

  constructor() {
    this.settings.apply();
  }

  t(key: string): string {
    return this.settings.t(key);
  }

  toggleSidebar(): void {
    this.sidebarCollapsed.update((collapsed) => !collapsed);
  }

  toggleTheme(): void {
    this.settings.toggleTheme();
  }

  toggleLanguage(): void {
    this.settings.toggleLanguage();
  }
}