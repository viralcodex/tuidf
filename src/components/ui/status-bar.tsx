import { TextAttributes } from "@opentui/core";
import { STATUS_COLORS } from "../../constants/constants";
import type { StatusType } from "../../model/models";

export function StatusBar(props: { message: string; type: StatusType }) {
  const getBorderColor = () => {
    switch (props.type) {
      case "error":
        return "#e74c3c";
      case "success":
        return "#27ae60";
      default:
        return "#3498db";
    }
  };

  return (
    <box
      border={["left", "bottom"]}
      borderColor={getBorderColor()}
      borderStyle="heavy"
      backgroundColor="#1a1a1a"
      paddingX={1}
      marginTop={1}
      flexShrink={0}
    >
      <text
        fg={STATUS_COLORS[props.type]}
        attributes={TextAttributes.BOLD}
        content={props.message}
      />
    </box>
  );
}
