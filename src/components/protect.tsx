import { createSignal, createEffect, onCleanup } from "solid-js";
import { protectPDF } from "../tools/protect";
import { openFile, getOutputPath, openOutputFolder } from "../utils/utils";
import { Button } from "./ui/button";
import { ButtonRow } from "./ui/button-row";
import { FileList } from "./ui/file-list";
import { StatusBar } from "./ui/status-bar";
import { TextInput } from "./ui/text-input";
import { ToolContainer } from "./ui/tool-container";
import { useKeyboardNav } from "../hooks/useKeyboardNav";
import { useFileListContext } from "../provider/fileListProvider";

export function ProtectUI() {
  const fl = useFileListContext();
  const nav = useKeyboardNav();
  const [userPassword, setUserPassword] = createSignal("");
  const [ownerPassword, setOwnerPassword] = createSignal("");
  const [focusedInput, setFocusedInput] = createSignal<string | null>(null);

  const canProtect = () => {
    const file = fl.selectedFile();
    const hasPassword = userPassword().trim().length > 0 || ownerPassword().trim().length > 0;
    return file !== null && hasPassword && !fl.isProcessing();
  };
  const canClearAll = () => fl.fileCount() > 0;

  const clearAll = () => {
    fl.clearAll();
    setUserPassword("");
    setOwnerPassword("");
  };

  const handleProtect = async () => {
    const file = fl.selectedFile();
    if (!file || fl.isProcessing()) return;

    if (!userPassword().trim() && !ownerPassword().trim()) {
      fl.setStatus({ msg: "Enter at least one password", type: "error" });
      return;
    }

    fl.setIsProcessing(true);
    fl.setStatus({ msg: "Protecting PDF...", type: "info" });

    try {
      const outputPath = await getOutputPath("protected", file);
      const res = await protectPDF({
        inputPath: file,
        outputPath,
        userPassword: userPassword().trim() || undefined,
        ownerPassword: ownerPassword().trim() || undefined,
      });

      if (res.success) {
        fl.setStatus({ msg: "PDF protected successfully", type: "success" });
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

      nav.registerElement({
        id: `file-${index}-remove`,
        type: "button",
        onEnter: () => fl.removeFile(index),
      });
    });

    // Register password inputs
    nav.registerElement({ id: "input-user-password", type: "input" });
    nav.registerElement({ id: "input-owner-password", type: "input" });

    // Register buttons
    nav.registerElement({
      id: "clear-all-btn",
      type: "button",
      onEnter: () => clearAll(),
      canFocus: () => canClearAll(),
    });
    nav.registerElement({
      id: "protect-btn",
      type: "button",
      onEnter: () => handleProtect(),
      canFocus: () => canProtect(),
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
          label="User Password (required to open):"
          value={userPassword}
          onInput={setUserPassword}
          placeholder="Leave empty for no open password"
          focused={focusedInput() === "input-user-password" || nav.isFocused("input-user-password")}
          onFocus={() => setFocusedInput("input-user-password")}
        />

        <TextInput
          label="Owner Password (required to modify):"
          value={ownerPassword}
          onInput={setOwnerPassword}
          placeholder="Leave empty to use user password"
          focused={
            focusedInput() === "input-owner-password" || nav.isFocused("input-owner-password")
          }
          onFocus={() => setFocusedInput("input-owner-password")}
        />
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
          label={fl.isProcessing() ? "Protecting..." : "Protect PDF"}
          color={canProtect() ? "cyan" : "gray"}
          disabled={!canProtect()}
          onClick={handleProtect}
          focused={nav.isFocused("protect-btn")}
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
