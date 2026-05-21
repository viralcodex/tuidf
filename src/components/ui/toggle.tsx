import { TextAttributes } from "@opentui/core";
import { createSignal } from "solid-js";
import { EmptyBorderChars, HIGHLIGHT_ACCENT_COLOR } from "../../constants/constants";

interface ToggleProps<T> {
  label: string;
  value: T;
  selected: T;
  onSelect: (value: T) => void;
  focused?: boolean;
}

export function Toggle<T>(props: ToggleProps<T>) {
  const [hovered, setHovered] = createSignal(false);
  const isSelected = () => props.value === props.selected;
  const isHighlighted = () => props.focused || hovered();

  return (
    <box
      border={["bottom"]}
      borderStyle={isSelected() ? "heavy" : "single"}
      borderColor={isHighlighted() ? HIGHLIGHT_ACCENT_COLOR : isSelected() ? "#3498db" : "#34495e"}
      backgroundColor={isSelected() ? "#1a2f3a" : "#1a1a1a"}
      customBorderChars={{
        ...EmptyBorderChars,
        horizontal: isHighlighted() ? "▄" : "▂",
      }}
      paddingX={2}
      paddingTop={1}
      justifyContent="center"
      alignItems="center"
      onMouseDown={() => props.onSelect(props.value)}
      onMouseOver={() => setHovered(true)}
      onMouseOut={() => setHovered(false)}
    >
      <text
        fg={isHighlighted() ? HIGHLIGHT_ACCENT_COLOR : isSelected() ? "#3498db" : "#7f8c8d"}
        attributes={isSelected() || isHighlighted() ? TextAttributes.BOLD : undefined}
        content={props.label}
      />
    </box>
  );
}
