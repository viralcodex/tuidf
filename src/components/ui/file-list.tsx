import { TextAttributes } from "@opentui/core";
import { useBindings } from "@opentui/keymap/solid";
import { Index, Show, createResource, createSignal } from "solid-js";
import type { Accessor } from "solid-js";
import { EmptyBorderChars, HIGHLIGHT_ACCENT_COLOR } from "../../constants/constants";
import { useDoubleClick } from "../../hooks/useDoubleClick";
import { useKeyboardNav } from "../../hooks/useKeyboardNav";
import { getFormattedFileMetadata, handleFileExplorer, openFile } from "../../utils/utils";
import { Label } from "./label";

interface FileListProps {
  header: string;
  files: Accessor<string[]>;
  fileType: "pdf" | "image";
  selectedIndex: Accessor<number | null>;
  onSelect: (index: number) => void;
  onFocusIndex?: (index: number) => void;
  onRemove: (index: number) => void;
  onMove?: (index: number, direction: "up" | "down") => void;
  onFilesSelected?: (files: string[]) => void;
  emptyText?: string;
  showReorder?: boolean;
  focusedIndex?: () => number | null;
  focusedButton?: () => string | null;
  onDoubleClick?: (index: number) => void;
}

export function FileList(props: FileListProps) {
  const fileCount = () => props.files().length;
  const handleRowClick = useDoubleClick<number>();
  const nav = useKeyboardNav();

  const [isPreviewOpen, setIsPreviewOpen] = createSignal(false);
  const [eClickedCount, setEClickedCount] = createSignal(0);
  let eTimer: ReturnType<typeof setTimeout> | null = null;

  const openFileExplorerFromShortcut = async () => {
    if (isPreviewOpen()) return;
    const files = await handleFileExplorer(undefined, props.fileType, setIsPreviewOpen);
    if (files.length > 0) {
      props.onFilesSelected?.(files);
    }
  };

  useBindings(() => ({
    priority: 90,
    bindings: nav.isInputMode()
      ? []
      : [
          {
            key: "e",
            cmd: () => {
              const currentCount = eClickedCount() + 1;
              setEClickedCount(currentCount);
              if (eTimer) {
                clearTimeout(eTimer);
              }
              if (currentCount >= 2) {
                setEClickedCount(0);
                void openFileExplorerFromShortcut();
              } else {
                eTimer = setTimeout(() => {
                  setEClickedCount(0);
                }, 700);
              }
            },
          },
        ],
  }));

  return (
    <box flexDirection="column" width="100%" flexGrow={1} minHeight={0}>
      <Label text={props.header} count={fileCount()} />
      <scrollbox
        border={["left"]}
        borderStyle="heavy"
        borderColor="#34495e"
        customBorderChars={{
          ...EmptyBorderChars,
          vertical: "▌",
          bottomLeft: "╹",
        }}
        backgroundColor="#1a1a1a"
        width="100%"
        flexGrow={1}
        minHeight={0}
        onMouseDown={async (e) => {
          if (isPreviewOpen()) return;
          const files = await handleFileExplorer(e, props.fileType, setIsPreviewOpen);
          if (files.length > 0) {
            props.onFilesSelected?.(files);
          }
        }}
      >
        <Show
          when={fileCount() > 0}
          fallback={
            <box flexGrow={1} alignItems="center" justifyContent="center" paddingY={1}>
              <text
                fg="#7f8c8d"
                content={
                  props.emptyText ||
                  "No files added. Click here, press E twice or drag files here to add."
                }
              />
            </box>
          }
        >
          <box flexDirection="column" width="100%" onMouseDown={(e) => e.stopPropagation()}>
            <Index each={props.files()}>
              {(file, index) => {
                const isSelected = () => props.selectedIndex() === index;
                const isFocused = () => props.focusedIndex?.() === index;
                const [metadata] = createResource(
                  () => file(),
                  (filePath) =>
                    getFormattedFileMetadata(filePath, {
                      includePageCount: props.fileType === "pdf",
                    }),
                );
                const [rowHovered, setRowHovered] = createSignal(false);
                const [openHovered, setOpenHovered] = createSignal(false);
                const [upHovered, setUpHovered] = createSignal(false);
                const [downHovered, setDownHovered] = createSignal(false);
                const [removeHovered, setRemoveHovered] = createSignal(false);
                const isRowHighlighted = () => (isFocused() || rowHovered()) && !isSelected();
                const isRowSelected = () => isSelected() && !isRowHighlighted();
                const canMoveUp = () => index > 0;
                const canMoveDown = () => index < fileCount() - 1;
                const metadataText = () => {
                  const currentMetadata = metadata();
                  if (!currentMetadata) {
                    return "Loading metadata...";
                  }

                  const parts = [currentMetadata.size];

                  if (props.fileType === "pdf") {
                    if (currentMetadata.pageCount === null) {
                      parts.push("counting pages...");
                    } else {
                      const pageLabel = currentMetadata.pageCount === 1 ? "page" : "pages";
                      parts.push(`${currentMetadata.pageCount} ${pageLabel}`);
                    }
                  }

                  if (currentMetadata.modified) {
                    parts.push(currentMetadata.modified);
                  }

                  return parts.join(" • ");
                };

                const isOpenHighlighted = () =>
                  props.focusedButton?.() === `file-${index}-open` || openHovered();

                const isUpHighlighted = () =>
                  canMoveUp() && (props.focusedButton?.() === `file-${index}-up` || upHovered());

                const isDownHighlighted = () =>
                  canMoveDown() &&
                  (props.focusedButton?.() === `file-${index}-down` || downHovered());

                const isRemoveHighlighted = () =>
                  props.focusedButton?.() === `file-${index}-remove` || removeHovered();

                return (
                  <box
                    flexDirection="row"
                    alignItems="center"
                    padding={1}
                    marginBottom={1}
                    backgroundColor={
                      isRowHighlighted() ? "#203949" : isRowSelected() ? "#1a342e" : "#333333"
                    }
                    onMouseDown={() =>
                      handleRowClick({
                        target: index,
                        onClick: (currentIndex) => {
                          props.onFocusIndex?.(currentIndex);
                          props.onSelect(currentIndex);
                        },
                        onDoubleClick: props.onDoubleClick,
                      })
                    }
                    onMouseOver={() => setRowHovered(true)}
                    onMouseOut={() => setRowHovered(false)}
                    columnGap={1}
                    width="100%"
                    border={["left"]}
                    borderColor={
                      isRowHighlighted()
                        ? "#8fd3ff"
                        : isRowSelected()
                          ? HIGHLIGHT_ACCENT_COLOR
                          : "#4b5563"
                    }
                    customBorderChars={{
                      ...EmptyBorderChars,
                      vertical: isRowHighlighted() ? "▍" : isRowSelected() ? "▍" : "┃",
                    }}
                  >
                    <text
                      fg={
                        isRowHighlighted()
                          ? "#8fd3ff"
                          : isSelected()
                            ? HIGHLIGHT_ACCENT_COLOR
                            : "yellow"
                      }
                      minWidth={3}
                      content={`${index + 1}.`}
                    />
                    <box flexDirection="column" flexGrow={1} flexShrink={1} minWidth={0}>
                      <text
                        fg={
                          isRowHighlighted() ? "#ffffff" : isRowSelected() ? "#d8fff1" : "#ecf0f1"
                        }
                        flexGrow={1}
                        flexShrink={1}
                        content={file()}
                        attributes={
                          isRowHighlighted() || isRowSelected() ? TextAttributes.BOLD : undefined
                        }
                      />
                      <text
                        fg={
                          isRowHighlighted() ? "#b6dff5" : isRowSelected() ? "#9ed9bc" : "#7f8c8d"
                        }
                        flexGrow={1}
                        flexShrink={1}
                        content={metadataText()}
                      />
                    </box>
                    <box flexDirection="row" columnGap={1} flexShrink={0}>
                      <box
                        border={["bottom"]}
                        borderColor={isOpenHighlighted() ? "#ffd166" : "#d29a2e"}
                        backgroundColor={isOpenHighlighted() ? "#5c4310" : "#3a2a0a"}
                        customBorderChars={{
                          ...EmptyBorderChars,
                          horizontal: isOpenHighlighted() ? "▄" : "▂",
                        }}
                        onMouseDown={(e: any) => {
                          e.stopPropagation?.();
                          void openFile(file());
                        }}
                        onMouseOver={() => setOpenHovered(true)}
                        onMouseOut={() => setOpenHovered(false)}
                        height={1}
                        paddingY={1}
                        paddingX={2}
                        minWidth={3}
                        justifyContent="center"
                        alignItems="center"
                      >
                        <text
                          fg={isOpenHighlighted() ? "#fff4bf" : "#f0c674"}
                          attributes={isOpenHighlighted() ? TextAttributes.BOLD : undefined}
                          content={"↗"}
                        />
                      </box>
                      <Show when={props.showReorder && props.onMove}>
                        <box
                          border={["bottom"]}
                          borderColor={
                            isUpHighlighted()
                              ? HIGHLIGHT_ACCENT_COLOR
                              : canMoveUp()
                                ? "#3498db"
                                : "#34495e"
                          }
                          backgroundColor={isUpHighlighted() ? "#1a4a3a" : "#2c3e50"}
                          customBorderChars={{
                            ...EmptyBorderChars,
                            horizontal: isUpHighlighted() ? "▄" : "▂",
                          }}
                          onMouseDown={(e: any) => {
                            e.stopPropagation?.();
                            props.onMove?.(index, "up");
                          }}
                          onMouseOver={() => setUpHovered(true)}
                          onMouseOut={() => setUpHovered(false)}
                          height={1}
                          paddingY={1}
                          paddingX={2}
                          minWidth={3}
                          justifyContent="center"
                          alignItems="center"
                        >
                          <text
                            fg={
                              isUpHighlighted()
                                ? HIGHLIGHT_ACCENT_COLOR
                                : canMoveUp()
                                  ? "#3498db"
                                  : "#7f8c8d"
                            }
                            attributes={isUpHighlighted() ? TextAttributes.BOLD : undefined}
                            content={"↑"}
                          />
                        </box>
                        <box
                          border={["bottom"]}
                          borderColor={
                            isDownHighlighted()
                              ? HIGHLIGHT_ACCENT_COLOR
                              : canMoveDown()
                                ? "#3498db"
                                : "#34495e"
                          }
                          backgroundColor={isDownHighlighted() ? "#1a4a3a" : "#2c3e50"}
                          customBorderChars={{
                            ...EmptyBorderChars,
                            horizontal: isDownHighlighted() ? "▄" : "▂",
                          }}
                          onMouseDown={(e: any) => {
                            e.stopPropagation?.();
                            props.onMove?.(index, "down");
                          }}
                          onMouseOver={() => setDownHovered(true)}
                          onMouseOut={() => setDownHovered(false)}
                          height={1}
                          paddingY={1}
                          paddingX={2}
                          minWidth={3}
                          justifyContent="center"
                          alignItems="center"
                        >
                          <text
                            fg={
                              isDownHighlighted()
                                ? HIGHLIGHT_ACCENT_COLOR
                                : canMoveDown()
                                  ? "#3498db"
                                  : "#7f8c8d"
                            }
                            attributes={isDownHighlighted() ? TextAttributes.BOLD : undefined}
                            content={"↓"}
                          />
                        </box>
                      </Show>
                      <box
                        border={["bottom"]}
                        borderColor={isRemoveHighlighted() ? "#ff6b6b" : "#e74c3c"}
                        backgroundColor={isRemoveHighlighted() ? "#5a1a1a" : "#3a1a1a"}
                        customBorderChars={{
                          ...EmptyBorderChars,
                          horizontal: isRemoveHighlighted() ? "▄" : "▂",
                        }}
                        onMouseDown={(e: any) => {
                          e.stopPropagation?.();
                          props.onRemove(index);
                        }}
                        onMouseOver={() => setRemoveHovered(true)}
                        onMouseOut={() => setRemoveHovered(false)}
                        height={1}
                        paddingY={1}
                        paddingX={2}
                        minWidth={3}
                        justifyContent="center"
                        alignItems="center"
                      >
                        <text
                          fg={isRemoveHighlighted() ? "#ff6b6b" : "#e74c3c"}
                          attributes={TextAttributes.BOLD}
                          content={"X"}
                        />
                      </box>
                    </box>
                  </box>
                );
              }}
            </Index>
          </box>
        </Show>
      </scrollbox>
    </box>
  );
}
