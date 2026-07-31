import { Component, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Category, CategoryInput, CategoryType } from '../models/category';
import { CategoryService } from '../services/category.service';

@Component({
  selector: 'app-category-form',
  imports: [ReactiveFormsModule],
  templateUrl: './category-form.component.html',
  styleUrl: './category-form.component.css',
})
export class CategoryFormComponent {
  private readonly service = inject(CategoryService);

  category = input<Category | null>(null);
  saving = signal(false);
  error = signal<string | null>(null);

  saved = output<Category>();
  closed = output<void>();

  readonly form = new FormGroup({
    name: new FormControl('', [Validators.required, Validators.pattern(/\S/)]),
    type: new FormControl<CategoryType>('expense', [Validators.required]),
    status: new FormControl<'enabled' | 'disabled'>('enabled', [Validators.required]),
    description: new FormControl(''),
    icon: new FormControl(''),
    color: new FormControl(''),
    display_order: new FormControl<number | null>(0),
  });

  get typeLocked(): boolean {
    return (this.category()?.transaction_count ?? 0) > 0;
  }

  constructor() {
    const current = this.category();
    if (current) {
      this.form.patchValue({
        name: current.name,
        type: current.type,
        status: current.status,
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
      description: value.description || null,
      icon: value.icon || null,
      color: value.color || null,
      display_order: value.display_order ?? null,
    };
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
        this.error.set(message ?? 'Something went wrong. Please try again.');
      },
    });
  }
}
