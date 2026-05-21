import { createSignal, createMemo, Show, createEffect, onCleanup } from "solid-js";
import { rotatePDF } from "../tools/rotate";
import { openFile, getOutputPath, openOutputFolder } from "../utils/utils";
import { Button } from "./ui/button";
import { ButtonRow } from "./ui/button-row";
import { FileList } from "./ui/file-list";
import { Label } from "./ui/label";
import { StatusBar } from "./ui/status-bar";
import { TextInput } from "./ui/text-input";
import { Toggle } from "./ui/toggle";
import { ToggleRow } from "./ui/toggle-row";
import { ToolContainer } from "./ui/tool-container";
import { useKeyboardNav } from "../hooks/useKeyboardNav";
import { useFileListContext } from "../provider/fileListProvider";

type Rotation = 90 | 180 | 270;
type PageMode = "all" | "specific";

export function RotateUI() {
  const fl = useFileListContext();
  const nav = useKeyboardNav();
  const [rotation, setRotation] = createSignal<Rotation>(90);
  const [pageMode, setPageMode] = createSignal<PageMode>("all");
  const [pagesInput, setPagesInput] = createSignal("");
  const [focusedInput, setFocusedInput] = createSignal<string | null>(null);

  const canRotate = createMemo(() => fl.selectedFile() !== null && !fl.isProcessing());
  const canClearAll = () => fl.fileCount() > 0;

  const clearAll = () => {
    fl.clearAll();
    setPagesInput("");
  };

  const handleRotate = async () => {
    const file = fl.selectedFile();
    if (!file || fl.isProcessing()) return;

    fl.setIsProcessing(true);
    fl.setStatus({ msg: "Rotating PDF...", type: "info" });

    try {
      const outputPath = await getOutputPath("rotated", file);
      let pages: number[] | "all" = "all";

      if (pageMode() === "specific") {
        pages = pagesInput()
          .split(",")
          .map((s) => parseInt(s.trim()))
          .filter((n) => !isNaN(n));
        if (pages.length === 0) {
          fl.setStatus({ msg: "Enter page numbers (e.g., 1, 2, 3)", type: "error" });
          fl.setIsProcessing(false);
          return;
        }
      }

      const res = await rotatePDF({ inputPath: file, outputPath, rotation: rotation(), pages });

      if (res.success) {
        fl.setStatus({
          msg: `Rotated ${res.rotatedPages} page(s) by ${rotation()}°`,
          type: "success",
        });
        openFile(outputPath);
      } else {
        fl.setStatus({ msg: res.error || "Unknown error", type: "error" });
      }
    } catch (error) {
      fl.setStatus({
        msg: error instanceof Error ? error.message : "Unknown error",
        type: "error",
      });
    } finally {
      fl.setIsProcessing(false);
    }
  };

  // Register keyboard navigation elements
  createEffect(() => {
    nav.clearElements();

    // Register file list items and remove buttons
    fl.files().forEach((_, index) => {
      nav.registerElement({
        id: `file-${index}-open`,
        type: "button",
        onEnter: () => openFile(fl.files()[index]!),
      });

      nav.registerElement({
        id: `file-${index}`,
        type: "list-item",
        onEnter: () => fl.selectFile(index),
      });

      // Remove button
      nav.registerElement({
        id: `file-${index}-remove`,
        type: "button",
        onEnter: () => fl.removeFile(index),
      });
    });

    // Register rotation toggles
    [90, 180, 270].forEach((deg) => {
      nav.registerElement({
        id: `rotation-${deg}`,
        type: "toggle",
        onEnter: () => setRotation(deg as Rotation),
      });
    });

    // Register page mode toggles
    nav.registerElement({
      id: "pagemode-all",
      type: "toggle",
      onEnter: () => setPageMode("all"),
    });
    nav.registerElement({
      id: "pagemode-specific",
      type: "toggle",
      onEnter: () => setPageMode("specific"),
    });

    // Register specific pages input if in specific mode
    if (pageMode() === "specific") {
      nav.registerElement({ id: "input-pages", type: "input" });
    }

    // Register buttons
    nav.registerElement({
      id: "clear-all-btn",
      type: "button",
      onEnter: () => clearAll(),
      canFocus: () => canClearAll(),
    });
    nav.registerElement({
      id: "rotate-btn",
      type: "button",
      onEnter: () => handleRotate(),
      canFocus: () => canRotate(),
    });
    nav.registerElement({
      id: "open-output-btn",
      type: "button",
      onEnter: () =>
        openOutputFolder().catch((_) =>
          fl.setStatus({ msg: "Failed to open folder", type: "error" }),
        ),
    });
  });

  createEffect(() => {
    nav.setIsInputMode(focusedInput() !== null);
  });

  // Sync back: reset focusedInput when nav exits input mode (Tab/Escape)
  createEffect(() => {
    if (!nav.isInputMode()) {
      setFocusedInput(null);
    }
  });

  onCleanup(() => {
    nav.clearElements();
  });

  return (
    <ToolContainer>
      <FileList
        header="Files"
        files={fl.files}
        fileType="pdf"
        selectedIndex={fl.selectedIndex}
        onSelect={fl.selectFile}
        onFocusIndex={(index) => nav.focusById(`file-${index}`)}
        onRemove={fl.removeFile}
        onFilesSelected={async (paths) => {
          await fl.addFilesToList(paths);
        }}
        focusedIndex={() => {
          const focusId = nav.getFocusedId();
          if (focusId && focusId.startsWith("file-")) {
            const parts = focusId.split("-");
            return parseInt(parts[1] || "0");
          }
          return null;
        }}
        focusedButton={() => nav.getFocusedId()}
      />

      <Label text="Rotation" paddingBottom={1} />
      <ToggleRow>
        <Toggle
          label="90° →"
          value={90 as Rotation}
          selected={rotation()}
          onSelect={setRotation}
          focused={nav.isFocused("rotation-90")}
        />
        <Toggle
          label="180°"
          value={180 as Rotation}
          selected={rotation()}
          onSelect={setRotation}
          focused={nav.isFocused("rotation-180")}
        />
        <Toggle
          label="270° ←"
          value={270 as Rotation}
          selected={rotation()}
          onSelect={setRotation}
          focused={nav.isFocused("rotation-270")}
        />
      </ToggleRow>

      <Label text="Apply to" paddingBottom={1} />
      <ToggleRow>
        <Toggle
          label="All Pages"
          value="all"
          selected={pageMode()}
          onSelect={setPageMode}
          focused={nav.isFocused("pagemode-all")}
        />
        <Toggle
          label="Specific Pages"
          value="specific"
          selected={pageMode()}
          onSelect={setPageMode}
          focused={nav.isFocused("pagemode-specific")}
        />
      </ToggleRow>

      <Show when={pageMode() === "specific"}>
        <TextInput
          label="Pages (comma-separated, e.g., 1, 2, 3):"
          value={pagesInput}
          onInput={setPagesInput}
          placeholder="1, 2, 3"
          focused={focusedInput() === "input-pages" || nav.isFocused("input-pages")}
          onFocus={() => setFocusedInput("input-pages")}
        />
      </Show>

      <ButtonRow>
        <Button
          label="Clear All"
          color={canClearAll() ? "yellow" : "gray"}
          disabled={!canClearAll()}
          onClick={clearAll}
          focused={nav.isFocused("clear-all-btn")}
        />
        <Button
          label={fl.isProcessing() ? "Rotating..." : "Rotate"}
          color={canRotate() ? "cyan" : "gray"}
          disabled={!canRotate()}
          onClick={handleRotate}
          focused={nav.isFocused("rotate-btn")}
        />
        <Button
          label="Open Output Folder"
          color="output"
          onClick={() =>
            openOutputFolder().catch((_) =>
              fl.setStatus({ msg: "Failed to open folder", type: "error" }),
            )
          }
          focused={nav.isFocused("open-output-btn")}
        />
      </ButtonRow>

      <StatusBar message={fl.status().msg} type={fl.status().type} />
    </ToolContainer>
  );
}
