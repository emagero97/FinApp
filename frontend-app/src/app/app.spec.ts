import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the brand and navigation', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.brand')?.textContent).toContain('FinApp');
    expect(compiled.querySelector('a[href="/transactions"]')?.textContent).toContain('Transactions');
    expect(compiled.querySelector('a[href="/categories"]')?.textContent).toContain('Categories');
  });

  it('should toggle the sidebar collapse', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.shell')?.classList.contains('sidebar-collapsed')).toBe(false);
    const button = Array.from(compiled.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Collapse')
    );
    button?.dispatchEvent(new Event('click'));
    fixture.detectChanges();
    expect(compiled.querySelector('.shell')?.classList.contains('sidebar-collapsed')).toBe(true);
  });
});
