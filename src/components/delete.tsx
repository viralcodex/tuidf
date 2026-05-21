import { createSignal, createMemo, Show, createEffect, onCleanup } from "solid-js";
import { deletePagesFromDocument } from "../tools/delete";
import {
  openFile,
  getOutputPath,
  openOutputFolder,
  savePdfDocument,
  loadPdfDocument,
} from "../utils/utils";
import { Button } from "./ui/button";
import { ButtonRow } from "./ui/button-row";
import { FileList } from "./ui/file-list";
import { StatusBar } from "./ui/status-bar";
import { TextInput } from "./ui/text-input";
import { ToolContainer } from "./ui/tool-container";
import { useKeyboardNav } from "../hooks/useKeyboardNav";
import { TextAttributes } from "@opentui/core";
import { useFileListContext } from "../provider/fileListProvider";

export function DeleteUI() {
  const fl = useFileListContext();
  const nav = useKeyboardNav();
  const [pagesInput, setPagesInput] = createSignal("");
  const [focusedInput, setFocusedInput] = createSignal<string | null>(null);

  const parsePagesInput = () => {
    return pagesInput()
      .split(",")
      .map((s) => parseInt(s.trim()))
      .filter((n) => !isNaN(n) && n >= 1 && n <= fl.pageCount());
  };

  const canDelete = createMemo(() => {
    const file = fl.selectedFile();
    const pages = parsePagesInput();
    return file !== null && pages.length > 0 && !fl.isProcessing();
  });
  const canClearAll = () => fl.fileCount() > 0;

  const clearAll = () => {
    fl.clearAll();
    setPagesInput("");
  };

  const handleDelete = async () => {
    const file = fl.selectedFile();
    if (!file || fl.isProcessing()) return;

    const pages = parsePagesInput();
    if (pages.length === 0) {
      fl.setStatus({ msg: "Enter page numbers to delete", type: "error" });
      return;
    }

    if (pages.length >= fl.pageCount()) {
      fl.setStatus({ msg: "Cannot delete all pages", type: "error" });
      return;
    }

    fl.setIsProcessing(true);
    fl.setStatus({ msg: "Deleting pages...", type: "info" });

    try {
      const outputPath = await getOutputPath("deleted", file);
      const pdfDoc = await loadPdfDocument(file);
      const res = deletePagesFromDocument(pdfDoc, pages);

      if (res.success) {
        await savePdfDocument(pdfDoc, outputPath);
        fl.setStatus({
          msg: `Deleted ${res.deletedPages} page(s), ${res.remainingPages} remaining`,
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
        id: `file-${index}`,
        type: "list-item",
        onEnter: () => fl.selectFile(index),
      });

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

    // Register pages input
    nav.registerElement({ id: "input-pages", type: "input" });

    // Register buttons
    nav.registerElement({
      id: "clear-all-btn",
      type: "button",
      onEnter: () => clearAll(),
      canFocus: () => canClearAll(),
    });
    nav.registerElement({
      id: "delete-btn",
      type: "button",
      onEnter: () => handleDelete(),
      canFocus: () => canDelete(),
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

      <Show when={fl.selectedFile()}>
        <box
          border={["left"]}
          borderColor="#3498db"
          borderStyle="heavy"
          backgroundColor="#1a2f3a"
          paddingLeft={1}
          paddingY={1}
          marginTop={1}
          flexShrink={0}
        >
          <box flexDirection="row" columnGap={1}>
            <text fg="#ecf0f1" content={"Selected:"} />
            <text fg="#3498db" attributes={TextAttributes.BOLD} content={fl.selectedFile() ?? ""} />
            <text fg="#95a5a6" content={`(${fl.pageCount()} pages)`} />
          </box>
        </box>
      </Show>

      <TextInput
        label="Pages to delete (comma-separated, e.g., 1, 3, 5):"
        value={pagesInput}
        onInput={setPagesInput}
        placeholder="1, 3, 5"
        focused={focusedInput() === "input-pages" || nav.isFocused("input-pages")}
        onFocus={() => setFocusedInput("input-pages")}
      />

      <ButtonRow>
        <Button
          label="Clear All"
          color={canClearAll() ? "yellow" : "gray"}
          disabled={!canClearAll()}
          onClick={clearAll}
          focused={nav.isFocused("clear-all-btn")}
        />
        <Button
          label={fl.isProcessing() ? "Deleting..." : "Delete Pages"}
          color={canDelete() ? "red" : "gray"}
          disabled={!canDelete()}
          onClick={handleDelete}
          focused={nav.isFocused("delete-btn")}
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
