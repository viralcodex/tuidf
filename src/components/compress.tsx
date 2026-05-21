import { TextAttributes } from "@opentui/core";
import { createSignal, Show, createEffect, onCleanup } from "solid-js";
import { compressPDF, formatFileSize } from "../tools/compress";
import { openFile, getOutputPath, openOutputFolder } from "../utils/utils";
import { Button } from "./ui/button";
import { ButtonRow } from "./ui/button-row";
import { FileList } from "./ui/file-list";
import { StatusBar } from "./ui/status-bar";
import { ToolContainer } from "./ui/tool-container";
import { useKeyboardNav } from "../hooks/useKeyboardNav";
import { useFileListContext } from "../provider/fileListProvider";

interface CompressionResult {
  originalSize: number;
  compressedSize: number;
  ratio: string;
  outputPath: string;
}

export function CompressUI() {
  const fl = useFileListContext();
  const nav = useKeyboardNav();
  const [result, setResult] = createSignal<CompressionResult | null>(null);

  const canClearAll = () => fl.fileCount() > 0;
  const canCompress = () => fl.selectedFile() && !fl.isProcessing();

  const clearAll = () => {
    fl.clearAll();
    setResult(null);
  };

  const handleCompress = async () => {
    const file = fl.selectedFile();
    if (!file || fl.isProcessing()) return;

    fl.setIsProcessing(true);
    fl.setStatus({ msg: "Compressing PDF...", type: "info" });

    try {
      const outputPath = await getOutputPath("compressed", file);
      const res = await compressPDF({ inputPath: file, outputPath });

      if (res.success && res.originalSize && res.compressedSize) {
        setResult({
          originalSize: res.originalSize,
          compressedSize: res.compressedSize,
          ratio: res.compressionRatio || "0%",
          outputPath,
        });
        fl.setStatus({ msg: `Compressed: ${res.compressionRatio} reduction`, type: "success" });
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
      onEnter: () => clearAll(),
      canFocus: () => canClearAll(),
    });

    nav.registerElement({
      id: "compress-btn",
      type: "button",
      onEnter: () => handleCompress(),
      canFocus: () => !!canCompress(),
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

      <Show when={result()}>
        <box flexDirection="column" marginTop={1} paddingLeft={1} flexShrink={0}>
          <text attributes={TextAttributes.BOLD} fg="green" content={"Compression Result:"} />
          <box flexDirection="row" marginTop={1}>
            <text fg="yellow" minWidth={15} content={"Original:"} />
            <text content={formatFileSize(result()!.originalSize)} />
          </box>
          <box flexDirection="row">
            <text fg="yellow" minWidth={15} content={"Compressed:"} />
            <text content={formatFileSize(result()!.compressedSize)} />
          </box>
          <box flexDirection="row">
            <text fg="yellow" minWidth={15} content={"Reduction:"} />
            <text fg="green" content={result()!.ratio} />
          </box>
        </box>
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
          label={fl.isProcessing() ? "Compressing..." : "Compress"}
          color={canCompress() ? "cyan" : "gray"}
          disabled={!canCompress()}
          onClick={handleCompress}
          focused={nav.isFocused("compress-btn")}
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
