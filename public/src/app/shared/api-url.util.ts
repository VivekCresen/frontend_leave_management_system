
export function resolveApiUrl(
  windowConfigKey: string,
  metaTagName: string,
  fallbackPath: string
): string {
  const configured = readConfiguredApiUrl(windowConfigKey, metaTagName);
  if (configured) return configured;

  const location = globalThis.location;
  if (!location?.hostname) return `http://localhost${fallbackPath}`;

  const protocol = location.protocol === 'https:' ? 'https:' : 'http:';
  return `${protocol}//${location.hostname}${fallbackPath}`;
}

function readConfiguredApiUrl(windowConfigKey: string, metaTagName: string): string | null {
  const windowConfig = (globalThis as Record<string, unknown>)[windowConfigKey];
  if (typeof windowConfig === 'string' && windowConfig.trim()) {
    return normalizeApiUrl(windowConfig);
  }

  const metaTagValue = globalThis.document
    ?.querySelector(`meta[name="${metaTagName}"]`)
    ?.getAttribute('content');

  return metaTagValue?.trim() ? normalizeApiUrl(metaTagValue) : null;
}

function normalizeApiUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}
