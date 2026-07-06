import { describe, expect, it } from "bun:test";

describe("useKeyboardNav hook module", () => {
  it("exists and includes exported navigation API", async () => {
    const file = new URL("../../src/hooks/useKeyboardNav.ts", import.meta.url);
    expect(await Bun.file(file).exists()).toBe(true);

    const code = await Bun.file(file).text();
    expect(code.includes("export function useKeyboardNav")).toBe(true);
    expect(code.includes("registerElement")).toBe(true);
    expect(code.includes("focusById")).toBe(true);
    expect(code.includes("clearElements")).toBe(true);
    expect(code.includes("setIsInputMode")).toBe(true);
    expect(code.includes("useBindings")).toBe(true);
    expect(code.includes('import { useKeyboard } from "@opentui/solid"')).toBe(false);
  });
});
