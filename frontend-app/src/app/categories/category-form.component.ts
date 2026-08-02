import { Component, inject, input, output, signal } from '@angular/core';
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
    }
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
