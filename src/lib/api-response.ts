// Proxies and framework failures can return text or HTML instead of API JSON.
export async function readApiResponse<T>(response: Response, fallback: string): Promise<T> {
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error(`${fallback} (HTTP ${response.status})`);
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`${fallback} (HTTP ${response.status})`);
  }
  const result = data as {success?: boolean; message?: unknown};
  if (!response.ok || result.success === false) {
    throw new Error(typeof result.message === 'string' && result.message ? result.message : `${fallback} (HTTP ${response.status})`);
  }
  return data as T;
}
