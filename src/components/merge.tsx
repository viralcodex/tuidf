import { createEffect, onCleanup } from "solid-js";
import { mergePDFs } from "../tools/merge";
import { openFile, getOutputPath, openOutputFolder } from "../utils/utils";
import { Button } from "./ui/button";
import { ButtonRow } from "./ui/button-row";
import { FileList } from "./ui/file-list";
import { StatusBar } from "./ui/status-bar";
import { ToolContainer } from "./ui/tool-container";
import { useKeyboardNav } from "../hooks/useKeyboardNav";
import { useFileListContext } from "../provider/fileListProvider";

export function MergeUI() {
  const fl = useFileListContext();
  const nav = useKeyboardNav();

  const canMerge = () => fl.fileCount() >= 2 && !fl.isProcessing();
  const canClearAll = () => fl.fileCount() > 0;

  const handleMerge = async () => {
    if (!canMerge()) return;

    fl.setIsProcessing(true);
    fl.setStatus({ msg: "Merging PDFs...", type: "info" });

    try {
      const outputPath = await getOutputPath("merged");
      const result = await mergePDFs({ inputPaths: fl.files(), outputPath });

      if (result.success) {
        fl.setStatus({ msg: `Merged ${result.pageCount} pages`, type: "success" });
        fl.clearAll();
        openFile(outputPath);
      } else {
        fl.setStatus({ msg: result.error || "Unknown error", type: "error" });
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

    // Register file list items and their action buttons
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

      // Move up button
      nav.registerElement({
        id: `file-${index}-up`,
        type: "button",
        onEnter: () => fl.moveFile(index, "up"),
        canFocus: () => index > 0,
      });

      // Move down button
      nav.registerElement({
        id: `file-${index}-down`,
        type: "button",
        onEnter: () => fl.moveFile(index, "down"),
        canFocus: () => index < fl.fileCount() - 1,
      });

      // Remove button
      nav.registerElement({
        id: `file-${index}-remove`,
        type: "button",
        onEnter: () => fl.removeFile(index),
      });
    });

    // Register buttons
    nav.registerElement({
      id: "clear-all-btn",
      type: "button",
      onEnter: () => fl.clearAll(),
      canFocus: () => canClearAll(),
    });

    nav.registerElement({
      id: "merge-btn",
      type: "button",
      onEnter: () => handleMerge(),
      canFocus: () => canMerge(),
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
        onMove={fl.moveFile}
        onFilesSelected={async (paths) => {
          await fl.addFilesToList(paths);
        }}
        showReorder={true}
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

      <ButtonRow>
        <Button
          label="Clear All"
          color={canClearAll() ? "#f3ae40" : "gray"}
          disabled={!canClearAll()}
          onClick={fl.clearAll}
          focused={nav.isFocused("clear-all-btn")}
        />
        <Button
          label={fl.isProcessing() ? "Merging..." : "Merge"}
          color={canMerge() ? "cyan" : "gray"}
          disabled={!canMerge()}
          onClick={handleMerge}
          focused={nav.isFocused("merge-btn")}
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
