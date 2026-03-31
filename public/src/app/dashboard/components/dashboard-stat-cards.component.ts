import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

export interface DashboardStatCard {
  label: string;
  value: string | number;
  note: string;
  tone?: 'teal' | 'orange' | 'slate';
  icon?: string;
}

@Component({
  selector: 'app-dashboard-stat-cards',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard-stat-cards.component.html',
  styleUrls: ['./dashboard-stat-cards.component.css']
})
export class DashboardStatCardsComponent {
  @Input({ required: true }) cards: DashboardStatCard[] = [];
  @Input() compact = false;
}
