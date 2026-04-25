import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastContainerComponent } from './toast-container/toast-container.component';
import { LoaderComponent } from './shared/components/loader/loader.component';
import { ThemeService } from './services/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastContainerComponent, LoaderComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'leave-app';

  // Inject ThemeService so it initializes on startup and applies the saved theme
  constructor(private readonly themeService: ThemeService) {}
}
