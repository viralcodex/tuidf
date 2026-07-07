import { createSignal, createMemo, createEffect, onCleanup } from "solid-js";
import { addPageNumbers } from "../tools/page-numbers";
import { openFile, getOutputPath, openOutputFolder } from "../utils/utils";
import { Button } from "./ui/button";
import { ButtonRow } from "./ui/button-row";
import { Dropdown } from "./ui/dropdown";
import { FileList } from "./ui/file-list";
import { Label } from "./ui/label";
import { StatusBar } from "./ui/status-bar";
import { TextInput } from "./ui/text-input";
import { ToolContainer } from "./ui/tool-container";
import { useKeyboardNav } from "../hooks/useKeyboardNav";
import { useFileListContext } from "../provider/fileListProvider";
import type { PageNumberPosition } from "../model/models";
import { StandardFonts } from "pdf-lib";

const POSITIONS: { label: string; value: PageNumberPosition }[] = [
  { label: "Bottom Center", value: "bottom-center" },
  { label: "Bottom Left", value: "bottom-left" },
  { label: "Bottom Right", value: "bottom-right" },
  { label: "Top Center", value: "top-center" },
  { label: "Top Left", value: "top-left" },
  { label: "Top Right", value: "top-right" },
];

const FONTS = Object.values(StandardFonts).map((font) => ({ label: String(font), value: font }));

export function PageNumbersUI() {
  const fl = useFileListContext();
  const nav = useKeyboardNav();
  const [position, setPosition] = createSignal<PageNumberPosition>("bottom-center");
  const [positionOpen, setPositionOpen] = createSignal(false);
  const [startInput, setStartInput] = createSignal("1");
  const [fontInput, setFontInput] = createSignal(StandardFonts.Helvetica);
  const [fontOpen, setFontOpen] = createSignal(false);
  const [fontSizeInput, setFontSizeInput] = createSignal("12");
  const [focusedInput, setFocusedInput] = createSignal<string | null>(null);

  const canApply = createMemo(() => fl.selectedFile() !== null && !fl.isProcessing());
  const canClearAll = () => fl.fileCount() > 0;

  const clearAll = () => {
    fl.clearAll();
    setStartInput("1");
    setFontInput(StandardFonts.Helvetica);
    setFontSizeInput("12");
  };

  const handleApply = async () => {
    const file = fl.selectedFile();
    if (!file || fl.isProcessing()) return;

    fl.setIsProcessing(true);
    fl.setStatus({ msg: "Adding page numbers...", type: "info" });

    try {
      const outputPath = await getOutputPath("numbered", file);
      const startNumber = parseInt(startInput().trim());

      const res = await addPageNumbers({
        inputPath: file,
        outputPath,
        position: position(),
        startNumber: isNaN(startNumber) ? 1 : startNumber,
      });

      if (res.success) {
        fl.setStatus({
          msg: `Added page numbers to ${res.numberedPages} page(s)`,
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

  createEffect(() => {
    nav.clearElements();

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

      nav.registerElement({
        id: `file-${index}-remove`,
        type: "button",
        onEnter: () => fl.removeFile(index),
      });
    });

    nav.registerElement({
      id: "position-dropdown",
      type: "button",
      onEnter: () => setPositionOpen(true),
    });

    nav.registerElement({
      id: "font-dropdown",
      type: "button",
      onEnter: () => setFontOpen(true),
    });

    nav.registerElement({ id: "input-start", type: "input" });
    nav.registerElement({ id: "input-font-size", type: "input" });

    nav.registerElement({
      id: "clear-all-btn",
      type: "button",
      onEnter: () => clearAll(),
      canFocus: () => canClearAll(),
    });
    nav.registerElement({
      id: "apply-btn",
      type: "button",
      onEnter: () => handleApply(),
      canFocus: () => canApply(),
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

      <box
        flexDirection="row"
        columnGap={2}
        paddingBottom={1}
        width="100%"
        flexShrink={0}
        zIndex={positionOpen() || fontOpen() ? 1001 : 0}
      >
        <box flexDirection="column" flexGrow={1} flexShrink={1} flexBasis={0} minWidth={0}>
          <Label text="Position" />
          <Dropdown
            options={POSITIONS}
            value={position()}
            onChange={setPosition}
            open={positionOpen()}
            onOpenChange={setPositionOpen}
            focused={nav.isFocused("position-dropdown")}
            width="100%"
            marginTop={0}
            marginBottom={0}
          />
        </box>
        <box flexDirection="column" flexGrow={1} flexShrink={1} flexBasis={0} minWidth={0}>
          <Label text="Font" />
          <Dropdown
            options={FONTS}
            value={fontInput()}
            onChange={setFontInput}
            open={fontOpen()}
            onOpenChange={setFontOpen}
            focused={nav.isFocused("font-dropdown")}
            width="100%"
            marginTop={0}
            marginBottom={0}
          />
        </box>
      </box>

      <box flexDirection="row" columnGap={2} width="100%" flexShrink={0}>
        <box flexDirection="column" flexGrow={1} flexShrink={1} flexBasis={0} minWidth={0}>
          <TextInput
            label="Start number:"
            value={startInput}
            onInput={setStartInput}
            placeholder="1"
            focused={focusedInput() === "input-start" || nav.isFocused("input-start")}
            onFocus={() => setFocusedInput("input-start")}
            width="100%"
            marginTop={0}
          />
        </box>
        <box flexDirection="column" flexGrow={1} flexShrink={1} flexBasis={0} minWidth={0}>
          <TextInput
            label="Font Size:"
            value={fontSizeInput}
            onInput={setFontSizeInput}
            placeholder="12"
            focused={focusedInput() === "input-font-size" || nav.isFocused("input-font-size")}
            onFocus={() => setFocusedInput("input-font-size")}
            width="100%"
            marginTop={0}
          />
        </box>
      </box>
      <ButtonRow>
        <Button
          label="Clear All"
          color={canClearAll() ? "yellow" : "gray"}
          disabled={!canClearAll()}
          onClick={clearAll}
          focused={nav.isFocused("clear-all-btn")}
        />
        <Button
          label={fl.isProcessing() ? "Adding..." : "Add Page Numbers"}
          color={canApply() ? "cyan" : "gray"}
          disabled={!canApply()}
          onClick={handleApply}
          focused={nav.isFocused("apply-btn")}
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
