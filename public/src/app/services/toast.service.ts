import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'info' | 'warn';

export interface ToastMessage {
  id: number;
  message: string;
  type: ToastType;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private readonly toastState = signal<ToastMessage[]>([]);
  private nextId = 1;

  readonly toasts = this.toastState.asReadonly();

  success(message: string): void {
    this.show(message, 'success');
  }

  error(message: string): void {
    this.show(message, 'error');
  }

  info(message: string): void {
    this.show(message, 'info');
  }

  warn(message: string): void {
    this.show(message, 'warn');
  }

  dismiss(id: number): void {
    this.toastState.update((toasts) => toasts.filter((toast) => toast.id !== id));
  }

  private show(message: string, type: ToastType): void {
    const id = this.nextId++;
    this.toastState.update((toasts) => [...toasts, { id, message, type }]);

    setTimeout(() => this.dismiss(id), 3000);
  }
}
