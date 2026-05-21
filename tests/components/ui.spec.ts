import { describe, expect, it } from "bun:test";

describe("ui component wiring", () => {
  it("has a matching source file", async () => {
    const file = new URL("../../src/components/ui/index.ts", import.meta.url);
    expect(await Bun.file(file).exists()).toBe(true);
  });

  it("wires the file-list open action to open the file instead of reordering", async () => {
    const file = new URL("../../src/components/ui/file-list.tsx", import.meta.url);
    const code = await Bun.file(file).text();
    const openButtonIndex = code.indexOf('content={"↗"}');

    expect(openButtonIndex).toBeGreaterThan(-1);

    const openButtonBlock = code.slice(Math.max(0, openButtonIndex - 1200), openButtonIndex + 200);

    expect(openButtonBlock.includes("void openFile(file());")).toBe(true);
    expect(openButtonBlock.includes('props.onMove?.(index, "up")')).toBe(false);
  });

  it("renders the shared file-list header from props", async () => {
    const file = new URL("../../src/components/ui/file-list.tsx", import.meta.url);
    const code = await Bun.file(file).text();

    expect(code.includes("<Label text={props.header} count={fileCount()} />")).toBe(true);
  });

  it("registers keyboard open actions for every file-list screen", async () => {
    const componentPaths = [
      "../../src/components/compress.tsx",
      "../../src/components/decrypt.tsx",
      "../../src/components/delete.tsx",
      "../../src/components/images-to-pdf.tsx",
      "../../src/components/merge.tsx",
      "../../src/components/pdf-to-images.tsx",
      "../../src/components/protect.tsx",
      "../../src/components/rotate.tsx",
      "../../src/components/split-extract.tsx",
    ];

    for (const componentPath of componentPaths) {
      const code = await Bun.file(new URL(componentPath, import.meta.url)).text();
      expect(code.includes("id: `file-${index}-open`")).toBe(true);
    }
  });
});
