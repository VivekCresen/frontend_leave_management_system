import { ColDef, GridApi } from 'ag-grid-community';

export const DEFAULT_COL_DEF: ColDef = {
  sortable: true,
  resizable: true,
  suppressHeaderMenuButton: true,
  suppressMovable: true
};

export function mountAgGrid(setMounted: () => void): void {
  queueMicrotask(setMounted);
}

export function syncGridOverlay<T>(gridApi: GridApi<T> | null, isLoading: boolean): void {
  if (!gridApi) return;
  if (isLoading) {
    gridApi.showLoadingOverlay();
  } else {
    gridApi.hideOverlay();
  }
}

export function safeGoToPage(page: number, totalPages: number, setter: (p: number) => void): void {
  if (page >= 1 && page <= totalPages) setter(page);
}
