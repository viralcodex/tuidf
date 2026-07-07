import { TextAttributes, type MouseEvent } from "@opentui/core";
import { useBindings } from "@opentui/keymap/solid";
import { createEffect, createSignal, For, Show } from "solid-js";
import { EmptyBorderChars, HIGHLIGHT_ACCENT_COLOR } from "../../constants/constants";

export interface DropdownOption<T> {
  label: string;
  value: T;
}

interface DropdownProps<T> {
  options: DropdownOption<T>[];
  value: T;
  onChange: (value: T) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  focused?: boolean;
  placeholder?: string;
  width?: number | "auto" | `${number}%`;
  marginTop?: number;
  marginBottom?: number;
}

const LIST_Z = 1001;
// Constant so the reserved flow space doesn't shift when the dropdown toggles.
const TRIGGER_HEIGHT = 3;

export function Dropdown<T>(props: DropdownProps<T>) {
  const [hovered, setHovered] = createSignal(false);
  const [highlight, setHighlight] = createSignal(0);

  const isHighlighted = () => props.focused || hovered() || props.open;

  const selectedLabel = () =>
    props.options.find((option) => option.value === props.value)?.label ??
    props.placeholder ??
    "Select...";

  const close = () => props.onOpenChange(false);

  const clampHighlight = (index: number) => Math.max(0, Math.min(index, props.options.length - 1));

  const moveHighlight = (delta: number) => {
    setHighlight((current) => clampHighlight(current + delta));
  };

  const selectAt = (index: number) => {
    const option = props.options[index];
    if (option) {
      props.onChange(option.value);
    }
    close();
  };

  const toggleOpen = () => props.onOpenChange(!props.open);

  createEffect(() => {
    if (!props.open) return;
    const currentIndex = props.options.findIndex((option) => option.value === props.value);
    setHighlight(currentIndex < 0 ? 0 : currentIndex);
  });

  useBindings(() => ({
    priority: 200,
    bindings: props.open
      ? [
          { key: "down", cmd: () => moveHighlight(1) },
          { key: "j", cmd: () => moveHighlight(1) },
          { key: "up", cmd: () => moveHighlight(-1) },
          { key: "k", cmd: () => moveHighlight(-1) },
          { key: "return", cmd: () => selectAt(highlight()) },
          { key: "escape", cmd: close },
          { key: "tab", cmd: close },
          { key: "shift+tab", cmd: close },
        ]
      : [],
  }));

  return (
    <box
      width={props.width ?? "auto"}
      flexShrink={1}
      minWidth={0}
      marginTop={props.marginTop ?? 1}
      zIndex={props.open ? LIST_Z : 0}
    >
      <box
        width="100%"
        border={["left"]}
        borderColor={isHighlighted() ? HIGHLIGHT_ACCENT_COLOR : "#34495e"}
        backgroundColor={props.open ? "#1a2f3a" : "#1a1a1a"}
        customBorderChars={{
          ...EmptyBorderChars,
          vertical: "▌",
          bottomLeft: "╹",
        }}
        flexDirection="row"
        alignItems="center"
        padding={1}
        onMouseDown={toggleOpen}
        onMouseOver={() => setHovered(true)}
        onMouseOut={() => setHovered(false)}
      >
        <text
          fg={isHighlighted() ? HIGHLIGHT_ACCENT_COLOR : "#bdc3c7"}
          attributes={isHighlighted() ? TextAttributes.BOLD : undefined}
          content={selectedLabel()}
        />
        <text
          fg={isHighlighted() ? HIGHLIGHT_ACCENT_COLOR : "#7f8c8d"}
          content={props.open ? "▲" : "▼"}
          marginLeft="auto"
        />
      </box>

      <Show when={props.open}>
        <scrollbox
          position="absolute"
          backgroundColor="#12212b"
          top={TRIGGER_HEIGHT}
          width="100%"
          height={Math.min(props.options.length, 7)}
          minHeight={7}
          contentOptions={{ flexDirection: "column", paddingY: 1 }}
        >
          <For each={props.options}>
            {(option, index) => {
              const active = () => highlight() === index();
              return (
                <box
                  paddingX={1}
                  backgroundColor={active() ? "#1f3d4d" : undefined}
                  onMouseOver={() => setHighlight(index())}
                  onMouseDown={(e?: MouseEvent) => {
                    e?.stopPropagation();
                    selectAt(index());
                  }}
                >
                  <text
                    fg={active() ? HIGHLIGHT_ACCENT_COLOR : "#bdc3c7"}
                    attributes={active() ? TextAttributes.BOLD : undefined}
                    content={option.label}
                  />
                </box>
              );
            }}
          </For>
        </scrollbox>
      </Show>
    </box>
  );
}
