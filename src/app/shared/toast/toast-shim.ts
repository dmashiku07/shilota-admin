import { DOCUMENT } from '@angular/common';
import { Inject, Injectable, ModuleWithProviders, NgModule } from '@angular/core';

export interface ToastrConfig {
  timeOut?: number;
  positionClass?: string;
  preventDuplicates?: boolean;
  progressBar?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ToastrService {
  private readonly visibleMessages = new Set<string>();

  constructor(@Inject(DOCUMENT) private readonly document: Document) {}

  success(message: unknown, title?: string, _options?: ToastrConfig): void {
    this.show('success', message, title);
  }

  error(message: unknown, title?: string, _options?: ToastrConfig): void {
    this.show('error', message, title);
  }

  info(message: unknown, title?: string, _options?: ToastrConfig): void {
    this.show('info', message, title);
  }

  warning(message: unknown, title?: string, _options?: ToastrConfig): void {
    this.show('warning', message, title);
  }

  private show(type: string, message: unknown, title?: string): void {
    const text = String(message ?? '');
    const key = `${type}:${title ?? ''}:${text}`;
    if (this.visibleMessages.has(key)) return;
    this.visibleMessages.add(key);

    let container = this.document.getElementById('toast-container');
    if (!container) {
      container = this.document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-top-right';
      this.document.body.appendChild(container);
    }

    const toast = this.document.createElement('div');
    toast.className = `toast toast-${type}`;
    if (title) {
      const heading = this.document.createElement('strong');
      heading.textContent = title;
      toast.appendChild(heading);
    }
    const body = this.document.createElement('div');
    body.textContent = text;
    toast.appendChild(body);
    container.appendChild(toast);

    setTimeout(() => {
      toast.remove();
      this.visibleMessages.delete(key);
      if (!container?.childElementCount) container?.remove();
    }, 3000);
  }
}

@NgModule()
export class ToastrModule {
  static forRoot(_config?: ToastrConfig): ModuleWithProviders<ToastrModule> {
    return { ngModule: ToastrModule };
  }
}
