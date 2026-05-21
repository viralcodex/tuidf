import { createSignal, Show, createEffect, onCleanup } from "solid-js";
import { pdfToImages } from "../tools/pdf-to-images";
import { getOutputDir, openFile, openOutputFolder } from "../utils/utils";
import { Button } from "./ui/button";
import { ButtonRow } from "./ui/button-row";
import { FileList } from "./ui/file-list";
import { Label } from "./ui/label";
import { StatusBar } from "./ui/status-bar";
import { Toggle } from "./ui/toggle";
import { ToggleRow } from "./ui/toggle-row";
import { ToolContainer } from "./ui/tool-container";
import { useKeyboardNav } from "../hooks/useKeyboardNav";
import { TextAttributes } from "@opentui/core";
import { useFileListContext } from "../provider/fileListProvider";

type ImageFormat = "png" | "jpg";
type DPIOption = 72 | 150 | 300;

export function PDFToImagesUI() {
  const fl = useFileListContext();
  const nav = useKeyboardNav();
  const [format, setFormat] = createSignal<ImageFormat>("png");
  const [dpi, setDpi] = createSignal<DPIOption>(150);

  const canConvert = () => fl.selectedFile() !== null && !fl.isProcessing();
  const canClearAll = () => fl.fileCount() > 0;

  const handleConvert = async () => {
    const file = fl.selectedFile();
    if (!file || fl.isProcessing()) return;

    fl.setIsProcessing(true);
    fl.setStatus({ msg: "Converting PDF to images...", type: "info" });

    try {
      const outputDir = await getOutputDir("pdf-images");
      const res = await pdfToImages({
        inputPath: file,
        outputDir,
        format: format(),
        dpi: dpi(),
        pages: "all",
      });

      if (res.success) {
        fl.setStatus({
          msg: `Created ${res.totalImages} image(s)`,
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

      nav.registerElement({
        id: `file-${index}-remove`,
        type: "button",
        onEnter: () => fl.removeFile(index),
      });
    });

    // Register format toggles
    nav.registerElement({
      id: "toggle-png",
      type: "toggle",
      onEnter: () => setFormat("png"),
    });
    nav.registerElement({
      id: "toggle-jpg",
      type: "toggle",
      onEnter: () => setFormat("jpg"),
    });

    // Register DPI toggles
    nav.registerElement({
      id: "toggle-72",
      type: "toggle",
      onEnter: () => setDpi(72),
    });
    nav.registerElement({
      id: "toggle-150",
      type: "toggle",
      onEnter: () => setDpi(150),
    });
    nav.registerElement({
      id: "toggle-300",
      type: "toggle",
      onEnter: () => setDpi(300),
    });

    // Register buttons
    nav.registerElement({
      id: "clear-all-btn",
      type: "button",
      onEnter: () => fl.clearAll(),
      canFocus: () => canClearAll(),
    });
    nav.registerElement({
      id: "convert-btn",
      type: "button",
      onEnter: () => handleConvert(),
      canFocus: () => canConvert(),
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

      <Label text="Format" paddingBottom={1} />
      <ToggleRow>
        <Toggle
          label="PNG"
          value="png"
          selected={format()}
          onSelect={setFormat}
          focused={nav.isFocused("toggle-png")}
        />
        <Toggle
          label="JPG"
          value="jpg"
          selected={format()}
          onSelect={setFormat}
          focused={nav.isFocused("toggle-jpg")}
        />
      </ToggleRow>

      <Label text="Quality (DPI)" paddingBottom={1} />
      <ToggleRow>
        <Toggle
          label="72 (Low)"
          value={72 as DPIOption}
          selected={dpi()}
          onSelect={setDpi}
          focused={nav.isFocused("toggle-72")}
        />
        <Toggle
          label="150 (Medium)"
          value={150 as DPIOption}
          selected={dpi()}
          onSelect={setDpi}
          focused={nav.isFocused("toggle-150")}
        />
        <Toggle
          label="300 (High)"
          value={300 as DPIOption}
          selected={dpi()}
          onSelect={setDpi}
          focused={nav.isFocused("toggle-300")}
        />
      </ToggleRow>

      <ButtonRow>
        <Button
          label="Clear All"
          color={canClearAll() ? "yellow" : "gray"}
          disabled={!canClearAll()}
          onClick={fl.clearAll}
          focused={nav.isFocused("clear-all-btn")}
        />
        <Button
          label={fl.isProcessing() ? "Converting..." : "Convert"}
          color={canConvert() ? "cyan" : "gray"}
          disabled={!canConvert()}
          onClick={handleConvert}
          focused={nav.isFocused("convert-btn")}
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
