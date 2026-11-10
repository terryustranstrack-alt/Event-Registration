import { describe, expect, it } from "vitest";
import { renderSimpleRichText } from "./simple-rich-text";

describe("renderSimpleRichText", () => {
  it("escapes HTML", () => {
    expect(renderSimpleRichText('<script>alert(1)</script>')).toBe("<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>");
  });
  it("renders bold, italic, links and lists", () => {
    expect(renderSimpleRichText("**Hi** *there*")).toBe("<p><strong>Hi</strong> <em>there</em></p>");
    expect(renderSimpleRichText("[Site](https://a.b/c)")).toContain('<a href="https://a.b/c"');
    expect(renderSimpleRichText("- one\n- two")).toBe("<ul><li>one</li><li>two</li></ul>");
  });
  it("does not allow javascript: links", () => {
    expect(renderSimpleRichText("[x](javascript:alert(1))")).not.toContain("<a");
  });
});
