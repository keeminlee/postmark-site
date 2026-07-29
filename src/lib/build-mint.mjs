export async function fetchBuiltMintedCumulative({
  fetchImpl = globalThis.fetch,
  url = "https://postmark.town/api/stamps",
  timeoutMs = 5000,
} = {}) {
  try {
    const response = await fetchImpl(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return null;
    const value = (await response.json())?.minted_cumulative;
    return Number.isSafeInteger(value) && value >= 0 ? value : null;
  } catch {
    return null;
  }
}
