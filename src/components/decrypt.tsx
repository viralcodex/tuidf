import { createSignal, Show, createEffect, onCleanup } from "solid-js";
import { unprotectPDF } from "../tools/protect";
import { openFile, getOutputPath, openOutputFolder } from "../utils/utils";
import { Button } from "./ui/button";
import { ButtonRow } from "./ui/button-row";
import { FileList } from "./ui/file-list";
import { StatusBar } from "./ui/status-bar";
import { TextInput } from "./ui/text-input";
import { ToolContainer } from "./ui/tool-container";
import { useKeyboardNav } from "../hooks/useKeyboardNav";
import { useFileListContext } from "../provider/fileListProvider";

export function DecryptUI() {
  const fl = useFileListContext();
  const nav = useKeyboardNav();
  const [password, setPassword] = createSignal("");
  const [focusedInput, setFocusedInput] = createSignal<string | null>(null);

  const canDecrypt = () => {
    const file = fl.selectedFile();
    const hasPassword = password().trim().length > 0;
    return file !== null && hasPassword && !fl.isProcessing();
  };
  const canClearAll = () => fl.fileCount() > 0;

  const clearAll = () => {
    fl.clearAll();
    setPassword("");
  };

  const handleDecrypt = async () => {
    const file = fl.selectedFile();
    if (!file || fl.isProcessing()) return;

    if (!password().trim()) {
      fl.setStatus({ msg: "Enter the PDF password", type: "error" });
      return;
    }

    fl.setIsProcessing(true);
    fl.setStatus({ msg: "Decrypting PDF...", type: "info" });

    try {
      const outputPath = await getOutputPath("decrypted", file);
      const res = await unprotectPDF(file, outputPath, password().trim());

      if (res.success) {
        fl.setStatus({ msg: "PDF decrypted successfully", type: "success" });
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

    // Register password input
    nav.registerElement({ id: "input-password", type: "input" });

    // Register buttons
    nav.registerElement({
      id: "clear-all-btn",
      type: "button",
      onEnter: () => clearAll(),
      canFocus: () => canClearAll(),
    });
    nav.registerElement({
      id: "decrypt-btn",
      type: "button",
      onEnter: () => handleDecrypt(),
      canFocus: () => canDecrypt(),
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

      <box flexDirection="column" marginTop={1} flexShrink={0}>
        <TextInput
          label="PDF Password:"
          value={password}
          onInput={setPassword}
          placeholder="Enter the password to unlock the PDF"
          focused={focusedInput() === "input-password" || nav.isFocused("input-password")}
          onFocus={() => setFocusedInput("input-password")}
        />
      </box>

      <box marginTop={1} paddingLeft={1} flexShrink={0}>
        <text fg="#95a5a6" content="Removes password protection from a PDF" />
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
          label={fl.isProcessing() ? "Decrypting..." : "Decrypt PDF"}
          color={canDecrypt() ? "cyan" : "gray"}
          disabled={!canDecrypt()}
          onClick={handleDecrypt}
          focused={nav.isFocused("decrypt-btn")}
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

      <Show when={fl.status().msg}>
        <StatusBar message={fl.status().msg} type={fl.status().type} />
      </Show>
    </ToolContainer>
  );
}
