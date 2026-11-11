import { describe, expect, it } from "vitest";
import { copySlugCandidate, EVENT_SLUG_RE } from "./slug-utils";

describe("copySlugCandidate", () => {
  it("adds -copy, then a number on later tries", () => {
    expect(copySlugCandidate("tech-meetup", 1)).toBe("tech-meetup-copy");
    expect(copySlugCandidate("tech-meetup", 3)).toBe("tech-meetup-copy-3");
  });

  it("stays within the 80-character limit and stays valid", () => {
    const long = "a".repeat(79) + "b";
    const result = copySlugCandidate(long, 12);
    expect(result.length).toBeLessThanOrEqual(80);
    expect(EVENT_SLUG_RE.test(result)).toBe(true);
  });
});
