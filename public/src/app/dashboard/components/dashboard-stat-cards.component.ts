import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface DashboardStatCard {
  label: string;
  value: string | number;
  note: string;
  tone?: 'teal' | 'orange' | 'slate';
  icon?: string;
  route?: string | string[];
  queryParams?: Record<string, string>;
  actionLabel?: string;
}

@Component({
  selector: 'app-dashboard-stat-cards',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard-stat-cards.component.html',
  styleUrls: ['./dashboard-stat-cards.component.css']
})
export class DashboardStatCardsComponent {
  @Input({ required: true }) cards: DashboardStatCard[] = [];
  @Input() compact = false;
}
