import { useTerminalDimensions } from "@opentui/solid";
import type { JSX } from "solid-js";

export function ToolContainer(props: {
  children: JSX.Element;
  paddingTop?: number;
  paddingBottom?: number;
}) {
  const terminalDimensions = useTerminalDimensions();
  const isCompact = () => terminalDimensions().height < 30;

  return (
    <box
      flexDirection="column"
      width="100%"
      height="100%"
      paddingX={2}
      paddingTop={props.paddingTop}
      paddingBottom={props.paddingBottom}
    >
      <box flexDirection="column" flexGrow={1} minHeight={0}>
        {isCompact() ? (
          <scrollbox width="100%" height="100%" flexGrow={1} minHeight={0}>
            <box flexDirection="column" width="100%" paddingBottom={1}>
              {props.children}
            </box>
          </scrollbox>
        ) : (
          props.children
        )}
      </box>
    </box>
  );
}
