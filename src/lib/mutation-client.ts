/** Retain an intent key on uncertain network/server failure, so retrying is safe. */
export function createMutationClient() {
  let pending: { body: string; key: string } | null = null;
  return async (url: string, payload: Record<string, unknown>) => {
    const body = JSON.stringify(payload);
    if (pending?.body !== body) pending = { body, key: crypto.randomUUID() };
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": pending.key }, body });
    const result = await response.json();
    if (response.ok || (response.status >= 400 && response.status < 500 && response.status !== 429)) pending = null;
    if (!response.ok) throw new Error(result.error || `Unable to save (${response.status}).`);
    return result;
  };
}
