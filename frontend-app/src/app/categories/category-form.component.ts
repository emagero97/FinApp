import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Category, CategoryInput, CategoryType } from '../models/category';
import { CategoryService } from '../services/category.service';
import { SettingsService } from '../services/settings.service';

@Component({
  selector: 'app-category-form',
  imports: [ReactiveFormsModule],
  templateUrl: './category-form.component.html',
  styleUrl: './category-form.component.css',
})
export class CategoryFormComponent {
  private readonly service = inject(CategoryService);
  private readonly settings = inject(SettingsService);

  category = input<Category | null>(null);
  parentOptions = input<Category[]>([]);
  saving = signal(false);
  error = signal<string | null>(null);

  colorPickerOpen = signal(false);
  emojiPickerOpen = signal(false);

  readonly palette = [
    '#ef4444',
    '#f97316',
    '#f59e0b',
    '#eab308',
    '#84cc16',
    '#22c55e',
    '#10b981',
    '#14b8a6',
    '#06b6d4',
    '#0ea5e9',
    '#3b82f6',
    '#6366f1',
    '#8b5cf6',
    '#a855f7',
    '#d946ef',
    '#ec4899',
    '#f43f5e',
    '#fb7185',
    '#fbbf24',
    '#facc15',
    '#a3e635',
    '#4ade80',
    '#2dd4bf',
    '#22d3ee',
    '#38bdf8',
    '#60a5fa',
    '#818cf8',
    '#a78bfa',
    '#c084fc',
    '#e879f9',
    '#f472b6',
    '#94a3b8',
    '#64748b',
    '#475569',
    '#334155',
    '#78716c',
    '#a16207',
    '#166534',
    '#155e75',
    '#7c2d12',
  ];

  readonly emojiOptions = [
    '💰',
    '💸',
    '💳',
    '🏦',
    '🤑',
    '🧾',
    '📈',
    '📉',
    '🧮',
    '💼',
    '📊',
    '🗂️',
    '🛒',
    '🏠',
    '🚗',
    '⛽',
    '🚌',
    '🚇',
    '🚕',
    '🛵',
    '🚲',
    '🍽️',
    '🍔',
    '🍕',
    '🌮',
    '🍎',
    '🥦',
    '🧀',
    '🥚',
    '🍞',
    '🍦',
    '☕',
    '🍺',
    '🍷',
    '🫖',
    '🛍️',
    '🎁',
    '👕',
    '👟',
    '🎮',
    '📺',
    '🎧',
    '💻',
    '🖥️',
    '📱',
    '📷',
    '⌚',
    '⏰',
    '🗓️',
    '✈️',
    '🏖️',
    '🌍',
    '🏥',
    '🩺',
    '💊',
    '🧼',
    '🧹',
    '🪴',
    '🌱',
    '💡',
    '🔌',
    '🔧',
    '🛏️',
    '🖼️',
    '📚',
    '🎓',
    '👶',
    '🐾',
    '🐶',
    '🐱',
    '⚽',
    '🎬',
    '🎵',
    '🎂',
    '🎉',
  ];

  saved = output<Category>();
  closed = output<void>();

  readonly form = new FormGroup({
    name: new FormControl('', [Validators.required, Validators.pattern(/\S/)]),
    type: new FormControl<CategoryType>('expense', [Validators.required]),
    status: new FormControl<'enabled' | 'disabled'>('enabled', [Validators.required]),
    parent_id: new FormControl<number | null>(null),
    description: new FormControl(''),
    icon: new FormControl(''),
    color: new FormControl(''),
    display_order: new FormControl<number | null>(0),
  });

  get typeLocked(): boolean {
    return (
      (this.category()?.transaction_count ?? 0) > 0 ||
      (this.category()?.child_count ?? 0) > 0
    );
  }

  get parentLocked(): boolean {
    return this.typeLocked || this.hasChildren();
  }

  private hasChildren(): boolean {
    return (this.category()?.child_count ?? 0) > 0;
  }

  get showParentField(): boolean {
    return this.eligibleParents().length > 0 || !!this.category()?.parent_id;
  }

  eligibleParents(): Category[] {
    const current = this.category();
    return this.parentOptions().filter(
      (c) => c.id !== current?.id && c.type === this.form.controls.type.value
    );
  }

  constructor() {
    effect(() => {
      const current = this.category();
      if (current) {
        this.form.patchValue({
          name: current.name,
          type: current.type,
          status: current.status,
          parent_id: current.parent_id,
          description: current.description ?? '',
          icon: current.icon ?? '',
          color: current.color ?? '',
          display_order: current.display_order ?? 0,
        });
      } else {
        this.form.reset({
          name: '',
          type: 'expense',
          status: 'enabled',
          parent_id: null,
          description: '',
          icon: '',
          color: '',
          display_order: 0,
        });
      }
    });
  }

  private buildInput(): CategoryInput {
    const value = this.form.value;
    return {
      name: value.name!.trim(),
      type: value.type!,
      status: value.status!,
      parent_id: value.parent_id ?? null,
      description: value.description || null,
      icon: value.icon || null,
      color: value.color || null,
      display_order: value.display_order ?? null,
    };
  }

  typeChanged(): void {
    this.form.controls.parent_id.setValue(null);
  }

  selectColor(color: string): void {
    this.form.controls.color.setValue(color);
    this.colorPickerOpen.set(false);
  }

  selectEmoji(emoji: string): void {
    this.form.controls.icon.setValue(emoji);
    this.emojiPickerOpen.set(false);
  }

  clearColor(): void {
    this.form.controls.color.setValue('');
  }

  clearIcon(): void {
    this.form.controls.icon.setValue('');
    this.emojiPickerOpen.set(false);
  }

  toggleColorPicker(): void {
    this.colorPickerOpen.update((v) => !v);
    this.emojiPickerOpen.set(false);
  }

  toggleEmojiPicker(): void {
    this.emojiPickerOpen.update((v) => !v);
    this.colorPickerOpen.set(false);
  }

  submit(): void {
    if (this.form.invalid) {
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    const input = this.buildInput();
    const current = this.category();
    const request = current
      ? this.service.update(current.id, input)
      : this.service.create(input);
    request.subscribe({
      next: (category) => this.saved.emit(category),
      error: (err) => {
        this.saving.set(false);
        const message = err?.error?.errors?.name ?? err?.error?.errors?.type ?? err?.error?.error;
        this.error.set(message ?? this.t('cat.error'));
      },
    });
  }

  t(key: string): string {
    return this.settings.t(key);
  }
}
