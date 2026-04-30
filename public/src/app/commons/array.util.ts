export function sortByField<T>(items: T[], key: keyof T, direction: 'asc' | 'desc' = 'asc'): T[] {
  return [...items].sort((a, b) => {
    const av = String(a[key] ?? '').toLowerCase();
    const bv = String(b[key] ?? '').toLowerCase();
    const cmp = av.localeCompare(bv);
    return direction === 'asc' ? cmp : -cmp;
  });
}

export function sortByDate<T>(items: T[], dateKey: keyof T, direction: 'asc' | 'desc' = 'desc'): T[] {
  return [...items].sort((a, b) => {
    const at = new Date(String(a[dateKey] ?? '')).getTime();
    const bt = new Date(String(b[dateKey] ?? '')).getTime();
    return direction === 'desc' ? bt - at : at - bt;
  });
}

export function filterByTerm<T>(items: T[], term: string, fields: (keyof T)[]): T[] {
  const t = term.trim().toLowerCase();
  if (!t) return items;
  return items.filter((item) =>
    fields.some((f) => {
      const v = item[f];
      return typeof v === 'string' && v.toLowerCase().includes(t);
    })
  );
}

export function uniqueFieldValues<T>(items: T[], key: keyof T): string[] {
  return Array.from(new Set(items.map((i) => String(i[key] ?? '')).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

export function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

export function totalPages(count: number, pageSize: number): number {
  return Math.ceil(count / pageSize);
}
