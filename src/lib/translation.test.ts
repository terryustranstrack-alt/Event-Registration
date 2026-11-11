import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { translateToIndonesian, TranslationNotConfiguredError } = await import("./translation");

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("translateToIndonesian", () => {
  it("needs an API key", async () => {
    vi.stubEnv("DEEPL_API_KEY", "");
    await expect(translateToIndonesian(["Hello"])).rejects.toBeInstanceOf(TranslationNotConfiguredError);
  });

  it("sends texts to the free endpoint and keeps their order", async () => {
    vi.stubEnv("DEEPL_API_KEY", "abc:fx");
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ translations: [{ text: "Halo" }, { text: "Dunia" }] }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    expect(await translateToIndonesian(["Hello", "World"])).toEqual(["Halo", "Dunia"]);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api-free.deepl.com/v2/translate");
    expect(JSON.parse(String(init.body))).toMatchObject({ text: ["Hello", "World"], source_lang: "EN", target_lang: "ID" });
  });

  it("reports DeepL errors", async () => {
    vi.stubEnv("DEEPL_API_KEY", "abc");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Quota exceeded", { status: 456 })));
    await expect(translateToIndonesian(["Hello"])).rejects.toThrow("DeepL error 456");
  });
});
