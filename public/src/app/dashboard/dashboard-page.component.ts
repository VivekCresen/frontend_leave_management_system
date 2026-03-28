import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { LoginResponse } from '../services/auth.service';
import { DashboardView } from './dashboard.config';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard-page.component.html',
  styleUrls: ['./dashboard-page.component.css']
})
export class DashboardPageComponent {
  @Input({ required: true }) view!: DashboardView;
  @Input({ required: true }) user!: LoginResponse;
}
