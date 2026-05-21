import { createSignal, Show, createEffect, onCleanup } from "solid-js";
import { useTerminalDimensions } from "@opentui/solid";
import { extractPDF, splitPDF } from "../tools/split-extract";
import { getOutputDir, openFile, openOutputFolder } from "../utils/utils";
import { useKeyboardNav } from "../hooks/useKeyboardNav";
import { Button } from "./ui/button";
import { ButtonRow } from "./ui/button-row";
import { FileList } from "./ui/file-list";
import { Label } from "./ui/label";
import { StatusBar } from "./ui/status-bar";
import { TextInput } from "./ui/text-input";
import { Toggle } from "./ui/toggle";
import { ToggleRow } from "./ui/toggle-row";
import { ToolContainer } from "./ui/tool-container";
import { EmptyBorderChars } from "../constants/constants";
import type { SplitMode, ExtractMode } from "../model";
import { useFileListContext } from "../provider/fileListProvider";

type ActionTypes =
  | {
      action: "split";
      mode: SplitMode;
      splitValue: number | number[];
    }
  | {
      action: "extract";
      mode: ExtractMode;
      splitValue: number | number[];
    };

export function SplitExtractUI() {
  const fl = useFileListContext();
  const nav = useKeyboardNav();
  const [splitMode, setSplitMode] = createSignal<SplitMode>("at");
  const [extractMode, setExtractMode] = createSignal<ExtractMode>("range");
  const [splitPagesInput, setSplitPagesInput] = createSignal("");
  const [splitEveryN, setSplitEveryN] = createSignal("");
  const [extractRangeStart, setExtractRangeStart] = createSignal("");
  const [extractRangeEnd, setExtractRangeEnd] = createSignal("");
  const [extractEveryN, setExtractEveryN] = createSignal("");
  const [focusedInput, setFocusedInput] = createSignal<string | null>(null);
  const terminalDimensions = useTerminalDimensions();
  const isCompact = () => terminalDimensions().height < 30 || terminalDimensions().width < 60;
  const stackToolPanels = () => terminalDimensions().width < 100;
  const stackRangeInputs = () => isCompact() || stackToolPanels();

  const canSplit = () => fl.selectedFile() !== null && !fl.isProcessing();
  const canExtract = () => fl.selectedFile() !== null && !fl.isProcessing();
  const canClearAll = () => fl.fileCount() > 0;

  const clearAll = () => {
    fl.clearAll();
    setSplitPagesInput("");
    setSplitEveryN("");
    setExtractRangeStart("");
    setExtractRangeEnd("");
    setExtractEveryN("");
  };

  const getRangeValue = () => {
    const start = parseInt(extractRangeStart()) || 1;
    const end = parseInt(extractRangeEnd()) || fl.pageCount();

    if (start < 1 || end > fl.pageCount() || start > end) {
      fl.setStatus({
        msg: `Page range must be between 1 and ${fl.pageCount()}`,
        type: "error",
      });
      return null;
    }

    return [start, end] as number[];
  };

  const getIntervalValue = (value: string, noun: string) => {
    const interval = parseInt(value) || 0;

    if (interval < 1) {
      fl.setStatus({
        msg: `${noun} must be at least 1`,
        type: "error",
      });
      return null;
    }

    return interval;
  };

  const runAction = async ({ action, mode, splitValue }: ActionTypes) => {
    const file = fl.selectedFile();
    if (!file || fl.isProcessing()) return;

    fl.setIsProcessing(true);
    fl.setStatus({
      msg: action === "split" ? "Splitting PDF..." : "Extracting pages...",
      type: "info",
    });

    try {
      const outputDir = await getOutputDir(action);

      const res =
        action === "split"
          ? await splitPDF({
              inputPath: file,
              outputDir,
              splitMode: mode,
              splitValue,
            })
          : await extractPDF({
              inputPath: file,
              outputDir,
              extractMode: mode,
              extractValue: splitValue,
            });

      if (res.success) {
        fl.setStatus({
          msg:
            action === "split"
              ? `Created ${res.totalFiles} split file(s)`
              : `Created ${res.totalFiles} extracted file(s)`,
          type: "success",
        });
        await openOutputFolder(outputDir).catch((_) =>
          fl.setStatus({ msg: "Failed to open folder", type: "error" }),
        );
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

  const handleSplit = async () => {
    let splitValue: number | number[] | null = null;

    if (splitMode() === "at") {
      const splitPage = parseInt(splitPagesInput()) || 0;
      if (splitPage < 1 || splitPage >= fl.pageCount()) {
        fl.setStatus({
          msg: `Split page must be between 1 and ${fl.pageCount() - 1}`,
          type: "error",
        });
        return;
      }
      splitValue = splitPage;
    } else {
      splitValue = getIntervalValue(splitEveryN(), "Split interval");
    }

    if (splitValue === null) return;
    await runAction({ action: "split", mode: splitMode(), splitValue });
  };

  const handleExtract = async () => {
    let splitValue: number | number[] | null = null;

    if (extractMode() === "range") {
      splitValue = getRangeValue();
    } else {
      splitValue = getIntervalValue(extractEveryN(), "Extract interval");
    }

    if (splitValue === null) return;
    await runAction({ action: "extract", mode: extractMode(), splitValue });
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

    // Register split controls
    nav.registerElement({
      id: "split-toggle-splitAt",
      type: "toggle",
      onEnter: () => setSplitMode("at"),
    });
    nav.registerElement({
      id: "split-toggle-every",
      type: "toggle",
      onEnter: () => setSplitMode("every"),
    });

    // Register extract controls
    nav.registerElement({
      id: "extract-toggle-range",
      type: "toggle",
      onEnter: () => setExtractMode("range"),
    });
    nav.registerElement({
      id: "extract-toggle-every",
      type: "toggle",
      onEnter: () => setExtractMode("every"),
    });

    // Register mode-specific inputs
    if (splitMode() === "at") {
      nav.registerElement({ id: "split-input-splitAt", type: "input" });
    } else {
      nav.registerElement({ id: "split-input-every", type: "input" });
    }

    if (extractMode() === "range") {
      nav.registerElement({ id: "extract-input-rangeStart", type: "input" });
      nav.registerElement({ id: "extract-input-rangeEnd", type: "input" });
    } else {
      nav.registerElement({ id: "extract-input-every", type: "input" });
    }

    // Register buttons
    nav.registerElement({
      id: "clear-all-btn",
      type: "button",
      onEnter: () => clearAll(),
      canFocus: () => canClearAll(),
    });
    nav.registerElement({
      id: "split-btn",
      type: "button",
      onEnter: () => handleSplit(),
      canFocus: () => canSplit(),
    });
    nav.registerElement({
      id: "extract-btn",
      type: "button",
      onEnter: () => handleExtract(),
      canFocus: () => canExtract(),
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
        flexDirection={stackToolPanels() ? "column" : "row"}
        rowGap={1}
        columnGap={1}
        flexShrink={0}
        marginTop={1}
      >
        <box
          flexDirection="column"
          flexShrink={0}
          flexGrow={1}
          width={stackToolPanels() ? "100%" : "50%"}
          border={["left"]}
          customBorderChars={{
            ...EmptyBorderChars,
            vertical: "▌",
            bottomLeft: "╹",
          }}
          borderColor="#3498db"
          borderStyle="heavy"
          backgroundColor="#182127"
          paddingX={1}
        >
          <Label text="Split" paddingBottom={1} />
          {/* <text fg="#95a5a6" content="Break the PDF into multiple files." paddingBottom={1}/> */}
          <ToggleRow>
            <Toggle
              label="Split At"
              value="at"
              selected={splitMode()}
              onSelect={setSplitMode}
              focused={nav.isFocused("split-toggle-splitAt")}
            />
            <Toggle
              label="Every N Pages"
              value="every"
              selected={splitMode()}
              onSelect={setSplitMode}
              focused={nav.isFocused("split-toggle-every")}
            />
          </ToggleRow>

          <Show when={splitMode() === "at"}>
            <TextInput
              label="Split after page:"
              value={splitPagesInput}
              onInput={setSplitPagesInput}
              placeholder={fl.pageCount() > 1 ? `1-${fl.pageCount() - 1}` : "1"}
              focused={
                focusedInput() === "split-input-splitAt" || nav.isFocused("split-input-splitAt")
              }
              onFocus={() => setFocusedInput("split-input-splitAt")}
            />
          </Show>

          <Show when={splitMode() === "every"}>
            <TextInput
              label="Split every N pages:"
              value={splitEveryN}
              onInput={setSplitEveryN}
              placeholder="2"
              focused={focusedInput() === "split-input-every" || nav.isFocused("split-input-every")}
              onFocus={() => setFocusedInput("split-input-every")}
            />
          </Show>

          <box marginBottom={1}>
            <Button
              label={fl.isProcessing() ? "Splitting..." : "Split"}
              color={canSplit() ? "cyan" : "gray"}
              disabled={!canSplit()}
              onClick={handleSplit}
              focused={nav.isFocused("split-btn")}
            />
          </box>
        </box>
        <box
          flexDirection="column"
          flexShrink={0}
          flexGrow={1}
          width={stackToolPanels() ? "100%" : "50%"}
          border={["left"]}
          customBorderChars={{
            ...EmptyBorderChars,
            vertical: "▌",
            bottomLeft: "╹",
          }}
          borderColor="#9b59b6"
          borderStyle="heavy"
          backgroundColor="#211c27"
          paddingX={1}
        >
          <Label text="Extract" paddingBottom={1} />
          {/* <text fg="#b8a7c9" content="Copy selected pages into new files." paddingBottom={1}/> */}
          <ToggleRow>
            <Toggle
              label="Range"
              value="range"
              selected={extractMode()}
              onSelect={setExtractMode}
              focused={nav.isFocused("extract-toggle-range")}
            />
            <Toggle
              label="Every N Pages"
              value="every"
              selected={extractMode()}
              onSelect={setExtractMode}
              focused={nav.isFocused("extract-toggle-every")}
            />
          </ToggleRow>

          <Show when={extractMode() === "range"}>
            <box
              flexDirection={stackRangeInputs() ? "column" : "row"}
              columnGap={stackRangeInputs() ? 0 : 1}
              rowGap={stackRangeInputs() ? 1 : 0}
              flexShrink={0}
              width="100%"
            >
              <TextInput
                label="From Page:"
                value={extractRangeStart}
                onInput={setExtractRangeStart}
                placeholder="1"
                focused={
                  focusedInput() === "extract-input-rangeStart" ||
                  nav.isFocused("extract-input-rangeStart")
                }
                onFocus={() => setFocusedInput("extract-input-rangeStart")}
                flexGrow={1}
                width={stackRangeInputs() ? "100%" : "30%"}
                marginTop={1}
                marginBottom={0}
              />
              <TextInput
                label="To Page:"
                value={extractRangeEnd}
                onInput={setExtractRangeEnd}
                placeholder={String(fl.pageCount() || "")}
                focused={
                  focusedInput() === "extract-input-rangeEnd" ||
                  nav.isFocused("extract-input-rangeEnd")
                }
                onFocus={() => setFocusedInput("extract-input-rangeEnd")}
                flexGrow={1}
                width={stackRangeInputs() ? "100%" : "30%"}
                marginTop={stackRangeInputs() ? 0 : 1}
                marginBottom={1}
              />
            </box>
          </Show>

          <Show when={extractMode() === "every"}>
            <TextInput
              label="Extract every N pages:"
              value={extractEveryN}
              onInput={setExtractEveryN}
              placeholder="2"
              focused={
                focusedInput() === "extract-input-every" || nav.isFocused("extract-input-every")
              }
              onFocus={() => setFocusedInput("extract-input-every")}
            />
          </Show>

          <box marginBottom={1}>
            <Button
              label={fl.isProcessing() ? "Extracting..." : "Extract"}
              color={canExtract() ? "magenta" : "gray"}
              disabled={!canExtract()}
              onClick={handleExtract}
              focused={nav.isFocused("extract-btn")}
            />
          </box>
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
