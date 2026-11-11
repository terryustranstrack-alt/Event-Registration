import "server-only";

// English → Indonesian translation with DeepL (free plan: 500,000 characters
// a month). Needs DEEPL_API_KEY; free-plan keys end in ":fx" and use DeepL's
// separate free address.

export class TranslationNotConfiguredError extends Error {
  constructor() {
    super("Translation is not set up (missing DEEPL_API_KEY).");
  }
}

function deeplEndpoint(apiKey: string): string {
  return apiKey.endsWith(":fx") ? "https://api-free.deepl.com/v2/translate" : "https://api.deepl.com/v2/translate";
}

/** Translate several English texts to Indonesian in one request, keeping their order. */
export async function translateToIndonesian(texts: string[]): Promise<string[]> {
  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) throw new TranslationNotConfiguredError();
  if (texts.length === 0) return [];

  const res = await fetch(deeplEndpoint(apiKey), {
    method: "POST",
    headers: { authorization: `DeepL-Auth-Key ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ text: texts, source_lang: "EN", target_lang: "ID", preserve_formatting: true }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`DeepL error ${res.status}: ${(await res.text()).slice(0, 200)}`);

  const data = (await res.json()) as { translations: { text: string }[] };
  return data.translations.map((t) => t.text);
}
