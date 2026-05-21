import { useTerminalDimensions } from "@opentui/solid";
import { EmptyBorderChars, HIGHLIGHT_ACCENT_COLOR, toolsMenu } from "../constants/constants";
import { TextAttributes } from "@opentui/core";
import { chunkArray } from "../utils/utils";
import { createEffect, createSignal, onCleanup } from "solid-js";
import { useKeyboardNav } from "../hooks/useKeyboardNav";

export function ToolsMenu(props: {
  selectedTool: () => string | null;
  selectTool: (toolName: string) => void;
}) {
  const { selectedTool, selectTool } = props;
  const nav = useKeyboardNav();
  const terminalDimensions = useTerminalDimensions();
  const [hoveredTool, setHoveredTool] = createSignal<string | null>(null);
  const isCompact = () => terminalDimensions().width < 105;
  const isVeryCompact = () => terminalDimensions().width < 54;
  const columns = () => (isCompact() ? (isVeryCompact() ? 1 : 2) : 4);
  const gap = () => (isCompact() ? 2 : 2);
  const rowWidth = () => Math.max(0, terminalDimensions().width - 6);
  const buttonWidth = () => {
    const cols = columns();
    const totalGap = gap() * (cols - 1);
    return Math.max(18, Math.floor((rowWidth() - totalGap) / cols));
  };

  const rows = () => chunkArray(toolsMenu, columns());

  // Register all tool menu items
  createEffect(() => {
    nav.clearElements();
    toolsMenu.forEach((tool) => {
      nav.registerElement({
        id: `tool-${tool.command}`,
        type: "tool",
        onEnter: () => selectTool(tool.command),
      });
    });
  });

  onCleanup(() => {
    nav.clearElements();
  });

  return (
    <box alignItems="center" justifyContent="center" flexDirection="column" rowGap={1}>
      {rows().map((row) => (
        <box
          alignItems="center"
          justifyContent="center"
          flexDirection="row"
          columnGap={gap()}
          width={rowWidth()}
        >
          {row.map((tool) => {
            const isSelected = () => selectedTool() === tool.command;
            const isFocused = () => nav.isFocused(`tool-${tool.command}`);
            const isHovered = () => hoveredTool() === tool.command;
            const isHighlighted = () => isFocused() || isHovered();
            return (
              <box
                alignItems="center"
                justifyContent="center"
                paddingX={3}
                paddingTop={1}
                onMouseDown={() => selectTool(tool.command)}
                onMouseOver={() => setHoveredTool(tool.command)}
                onMouseOut={() => setHoveredTool(null)}
                width={buttonWidth()}
                backgroundColor={"#2c3e50"}
                border={["bottom"]}
                borderColor={isHighlighted() ? HIGHLIGHT_ACCENT_COLOR : "#e74c3c"}
                borderStyle="heavy"
                customBorderChars={{
                  ...EmptyBorderChars,
                  horizontal: isHighlighted() ? "▄" : "▂",
                }}
              >
                <text
                  fg={
                    isHighlighted() ? HIGHLIGHT_ACCENT_COLOR : isSelected() ? "#ffffff" : "#e2e8f0"
                  }
                  attributes={isSelected() || isHighlighted() ? TextAttributes.BOLD : undefined}
                  content={String(tool.name)}
                />
              </box>
            );
          })}
        </box>
      ))}
    </box>
  );
}
