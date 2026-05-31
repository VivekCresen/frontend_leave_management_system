import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, inject } from '@angular/core';
import { AuthApiService } from '../../services/auth-api.service';
import { ToastService } from '../../services/toast.service';
import { downloadBlob } from '../../commons/api.util';

type ImportState = 'idle' | 'uploading' | 'success' | 'error';
type LcrStep = 'load' | 'check' | 'resolve';

export interface RowError {
  row: number;
  username: string;
  reason: string;
}

@Component({
  selector: 'app-user-excel-import',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './user-excel-import.component.html',
  styleUrls: ['./user-excel-import.component.css']
})
export class UserExcelImportComponent {
  private readonly authService = inject(AuthApiService);
  private readonly toastService = inject(ToastService);

  @Output() importCompleted = new EventEmitter<void>();

  state: ImportState = 'idle';
  lcrStep: LcrStep = 'load';
  selectedFile: File | null = null;
  isDragging = false;
  isDownloading = false;
  importedCount = 0;
  errorMessage = '';
  rowErrors: RowError[] = [];
  showAllErrors = false;

  get isUploading(): boolean { return this.state === 'uploading'; }
  get isSuccess(): boolean   { return this.state === 'success'; }
  get isError(): boolean     { return this.state === 'error'; }

  get visibleErrors(): RowError[] {
    return this.showAllErrors ? this.rowErrors : this.rowErrors.slice(0, 5);
  }

  get hasMoreErrors(): boolean {
    return this.rowErrors.length > 5;
  }

  downloadTemplate(): void {
    if (this.isDownloading) return;
    this.isDownloading = true;
    this.authService.downloadImportTemplate().subscribe({
      next: (blob) => {
        this.isDownloading = false;
        downloadBlob(blob, 'user_import_template.xlsx');
        this.toastService.success('Template downloaded');
      },
      error: () => {
        this.isDownloading = false;
        this.toastService.error('Failed to download template');
      }
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.setFile(input.files[0]);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = true;
  }

  onDragLeave(): void {
    this.isDragging = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = false;
    const file = event.dataTransfer?.files[0];
    if (file) this.setFile(file);
  }

  clearFile(): void {
    this.selectedFile = null;
    this.state = 'idle';
    this.lcrStep = 'load';
    this.errorMessage = '';
    this.rowErrors = [];
    this.showAllErrors = false;
  }

  uploadFile(): void {
    if (!this.selectedFile || this.isUploading) return;

    this.state = 'uploading';
    this.lcrStep = 'check';
    this.errorMessage = '';
    this.rowErrors = [];

    this.authService.importUsersFromExcel(this.selectedFile).subscribe({
      next: (result) => {
        this.state = 'success';
        this.lcrStep = 'load';
        this.importedCount = result.imported;
        this.toastService.success(result.message);
        this.importCompleted.emit();
      },
      error: (err) => {
        this.lcrStep = 'resolve';
        if (err.status === 422 && err.error instanceof Blob) {
          this.state = 'error';
          this.errorMessage = 'Some rows have validation errors. Check the downloaded error file for details.';
          this.parseErrorHeaders(err.headers);
          this.downloadErrorBlob(err.error);
        } else if (err.status === 400 && err.error instanceof Blob) {
          // bad request — read the blob as text to get the message
          (err.error as Blob).text().then(text => {
            try {
              const json = JSON.parse(text);
              this.errorMessage = json.message || 'Invalid file or request.';
            } catch {
              this.errorMessage = 'Invalid file or request.';
            }
          });
          this.state = 'error';
        } else {
          this.state = 'error';
          this.errorMessage = err.error?.message || 'Import failed. Please try again.';
          this.toastService.error(this.errorMessage);
        }
      }
    });
  }

  toggleShowAllErrors(): void {
    this.showAllErrors = !this.showAllErrors;
  }

  private setFile(file: File): void {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      this.toastService.error('Only .xlsx or .xls files are supported');
      return;
    }
    this.selectedFile = file;
    this.state = 'idle';
    this.lcrStep = 'load';
    this.errorMessage = '';
    this.rowErrors = [];
    this.showAllErrors = false;
  }

  private parseErrorHeaders(headers: any): void {
    try {
      const raw = headers?.get('X-Error-Rows');
      if (raw) {
        this.rowErrors = JSON.parse(raw) as RowError[];
      }
    } catch {
    }
  }

  private downloadErrorBlob(blob: Blob): void {
    downloadBlob(blob, 'user_import_errors.xlsx');
    this.toastService.warn('Error file downloaded. Fix the highlighted rows and re-upload.');
  }
}
