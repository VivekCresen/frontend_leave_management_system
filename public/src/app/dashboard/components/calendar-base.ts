import { Directive, OnDestroy } from '@angular/core';

/** Shared calendar navigation state and helpers for dashboard role views. */
@Directive()
export abstract class CalendarBase implements OnDestroy {
  calendarYear = new Date().getFullYear();
  calendarMonth = new Date().getMonth();
  jumpDate = '';
  readonly weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  ngOnDestroy(): void {}

  get calendarMonthLabel(): string {
    return new Date(this.calendarYear, this.calendarMonth, 1)
      .toLocaleString('default', { month: 'long', year: 'numeric' });
  }

  prevMonth(): void {
    if (this.calendarMonth === 0) { this.calendarMonth = 11; this.calendarYear--; }
    else { this.calendarMonth--; }
    this.buildCalendar();
  }

  nextMonth(): void {
    if (this.calendarMonth === 11) { this.calendarMonth = 0; this.calendarYear++; }
    else { this.calendarMonth++; }
    this.buildCalendar();
  }

  goToToday(): void {
    const now = new Date();
    this.calendarYear = now.getFullYear();
    this.calendarMonth = now.getMonth();
    this.jumpDate = this.toMonthValue(this.calendarYear, this.calendarMonth);
    this.buildCalendar();
  }

  onJumpDateChange(value: string): void {
    if (!value) return;
    const [y, m] = value.split('-').map(Number);
    this.calendarYear = y;
    this.calendarMonth = m - 1;
    this.buildCalendar();
  }

  protected toMonthValue(year: number, month: number): string {
    return `${year}-${String(month + 1).padStart(2, '0')}`;
  }

  protected abstract buildCalendar(): void;
}
