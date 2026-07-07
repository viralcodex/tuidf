import { TextAttributes } from "@opentui/core";
import type { Accessor, Setter } from "solid-js";
import { EmptyBorderChars, HIGHLIGHT_ACCENT_COLOR } from "../../constants/constants";

interface TextInputProps<T> {
  label: string;
  value: Accessor<T>;
  onInput: Setter<T>;
  placeholder?: string;
  focused: boolean;
  onFocus: () => void;
  onSubmit?: () => void;
  flexGrow?: number;
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  paddingRight?: number;
  width?: number | "auto" | `${number}%`;
}

export function TextInput<T>(props: TextInputProps<T>) {
  const borderColor = () => (props.focused ? HIGHLIGHT_ACCENT_COLOR : "#34495e");

  return (
    <box
      flexDirection="column"
      marginTop={props.marginTop ?? 1}
      marginBottom={props.marginBottom ?? 1}
      alignItems="stretch"
      flexShrink={0}
      flexGrow={props.flexGrow}
      width={props.width ?? "100%"}
    >
      <text fg="#ecf0f1" attributes={TextAttributes.BOLD} content={props.label} />
      <box
        border={["left"]}
        borderStyle="heavy"
        borderColor={borderColor()}
        customBorderChars={{
          ...EmptyBorderChars,
          vertical: "▌",
          horizontal: "▂",
        }}
        backgroundColor="#1a1a1a"
        padding={1}
        paddingBottom={props.paddingBottom ?? 1}
        width="100%"
      >
        <input
          focused={props.focused}
          value={String(props.value())}
          onInput={props.onInput}
          onSubmit={props.onSubmit}
          placeholder={props.placeholder}
          onMouseDown={props.onFocus}
          width={"100%"}
        />
      </box>
    </box>
  );
}
