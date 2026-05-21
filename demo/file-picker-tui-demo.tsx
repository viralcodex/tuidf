/**
 * Demo: OpenTUI File Picker with osascript
 * Run with: bun scripts/file-picker-tui-demo.tsx
 */

import { render, useKeyboard } from "@opentui/solid";
import { createSignal, For, Show } from "solid-js";
import { TextAttributes, type KeyEvent } from "@opentui/core";
import { $ } from "bun";
import { basename } from "path";

// ============= File Picker Utils =============

async function openFilePicker(
  options: {
    prompt?: string;
    fileTypes?: string[];
    multiple?: boolean;
  } = {},
): Promise<string[]> {
  const { prompt = "Select files", fileTypes, multiple = true } = options;

  let script = `choose file with prompt "${prompt}"`;

  if (fileTypes && fileTypes.length > 0) {
    const types = fileTypes.map((t) => `"${t}"`).join(", ");
    script += ` of type {${types}}`;
  }

  if (multiple) {
    script += " with multiple selections allowed";
  }

  const fullScript = `
    try
      set selectedFiles to ${script}
      if class of selectedFiles is list then
        set output to ""
        repeat with f in selectedFiles
          set output to output & POSIX path of f & linefeed
        end repeat
        return output
      else
        return POSIX path of selectedFiles
      end if
    on error number -128
      return ""
    end try
  `;

  try {
    const result = await $`osascript -e ${fullScript}`.text();
    return result
      .trim()
      .split("\n")
      .filter((f) => f.length > 0);
  } catch {
    return [];
  }
}

async function openFolderPicker(prompt = "Select a folder"): Promise<string | null> {
  const fullScript = `
    try
      set selectedFolder to choose folder with prompt "${prompt}"
      return POSIX path of selectedFolder
    on error number -128
      return ""
    end try
  `;

  try {
    const result = await $`osascript -e ${fullScript}`.text();
    const folder = result.trim();
    return folder.length > 0 ? folder : null;
  } catch {
    return null;
  }
}

// ============= TUI App =============

function FilePickerDemo() {
  const [selectedFiles, setSelectedFiles] = createSignal<string[]>([]);
  const [selectedFolder, setSelectedFolder] = createSignal<string | null>(null);
  const [focusedButton, setFocusedButton] = createSignal(0);
  const [status, setStatus] = createSignal("Press Enter to select files");
  const [isLoading, setIsLoading] = createSignal(false);

  const buttons = [
    { label: "Select Images", key: "images" },
    { label: "Select Folder", key: "folder" },
    { label: "Clear All", key: "clear" },
    { label: "Exit", key: "exit" },
  ];

  const handleAction = async (action: string) => {
    if (isLoading()) return;

    setIsLoading(true);
    setStatus("Opening dialog...");

    try {
      switch (action) {
        case "pdf": {
          const files = await openFilePicker({
            prompt: "Select PDF files",
            fileTypes: ["pdf"],
            multiple: true,
          });
          if (files.length > 0) {
            setSelectedFiles((prev) => [...prev, ...files]);
            setStatus(`Added ${files.length} PDF file(s)`);
          } else {
            setStatus("Selection cancelled");
          }
          break;
        }
        case "images": {
          const files = await openFilePicker({
            prompt: "Select image files",
            fileTypes: ["png", "jpg", "jpeg", "gif", "webp"],
            multiple: true,
          });
          if (files.length > 0) {
            setSelectedFiles((prev) => [...prev, ...files]);
            setStatus(`Added ${files.length} image file(s)`);
          } else {
            setStatus("Selection cancelled");
          }
          break;
        }
        case "folder": {
          const folder = await openFolderPicker("Select output folder");
          if (folder) {
            setSelectedFolder(folder);
            setStatus(`Folder: ${folder}`);
          } else {
            setStatus("Selection cancelled");
          }
          break;
        }
        case "clear": {
          setSelectedFiles([]);
          setSelectedFolder(null);
          setStatus("Cleared all selections");
          break;
        }
        case "exit": {
          process.exit(0);
        }
      }
    } catch (error) {
      setStatus(`Error: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  useKeyboard((event: KeyEvent) => {
    if (isLoading()) return;

    switch (event.name) {
      case "left":
      case "h":
        setFocusedButton((prev) => Math.max(0, prev - 1));
        break;
      case "right":
      case "l":
        setFocusedButton((prev) => Math.min(buttons.length - 1, prev + 1));
        break;
      case "return": {
        const btn = buttons[focusedButton()];
        if (btn) handleAction(btn.key);
        break;
      }
      case "1":
        handleAction("pdf");
        break;
      case "2":
        handleAction("images");
        break;
      case "3":
        handleAction("folder");
        break;
      case "c":
        handleAction("clear");
        break;
      case "q":
      case "escape":
        process.exit(0);
    }
  });

  return (
    <box
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      flexGrow={1}
      backgroundColor="#111111"
    >
      {/* Header */}
      <box padding={1}>
        <text fg="#00d4ff" attributes={TextAttributes.BOLD} content="File Picker Demo" />
      </box>

      {/* Button Row */}
      <box flexDirection="row" columnGap={1} padding={1}>
        <For each={buttons}>
          {(btn, index) => (
            <box
              border
              borderColor={focusedButton() === index() ? "#00d4ff" : "#444"}
              backgroundColor={focusedButton() === index() ? "#131313" : "#161616"}
              paddingX={2}
              onMouseDown={() => handleAction(btn.key)}
            >
              <text fg={focusedButton() === index() ? "#00d4ff" : "#888"} content={btn.label} />
            </box>
          )}
        </For>
      </box>

      {/* Status */}
      <box padding={1}>
        <text fg={isLoading() ? "#ffaa00" : "#888"} content={status()} />
      </box>

      {/* Selected Files */}
      <box border borderColor="#333" width={60} minHeight={8} flexDirection="column" padding={1}>
        <text
          fg="#00d4ff"
          attributes={TextAttributes.BOLD}
          content={`Selected Files (${selectedFiles().length}):`}
        />
        <Show
          when={selectedFiles().length > 0}
          fallback={<text fg="#555" content="No files selected" />}
        >
          <For each={selectedFiles().slice(0, 10)}>
            {(file) => <text fg="#aaa" content={`• ${basename(file)}`} />}
          </For>
        </Show>
        <Show when={selectedFiles().length > 10}>
          <text fg="#666" content={`... and ${selectedFiles().length - 10} more`} />
        </Show>
      </box>

      {/* Selected Folder */}
      <Show when={selectedFolder()}>
        <box padding={1}>
          <text fg="#00ff88" content={`Output: ${selectedFolder()}`} />
        </box>
      </Show>

      {/* Help */}
      <box padding={1}>
        <text
          fg="#555"
          content="Left/Right Navigate | Enter Select | 1-3 Quick | C Clear | Q Quit"
        />
      </box>
    </box>
  );
}

render(() => <FilePickerDemo />);
