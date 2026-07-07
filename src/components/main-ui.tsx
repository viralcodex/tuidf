import { Dynamic, useTerminalDimensions } from "@opentui/solid";
import { createEffect, createSignal, Show } from "solid-js";
import { MergeUI } from "./merge";
import { CompressUI } from "./compress";
import { RotateUI } from "./rotate";
import { SplitExtractUI } from "./split-extract";
import { DeleteUI } from "./delete";
import { PDFToImagesUI } from "./pdf-to-images";
import { ImagesToPDFUI } from "./images-to-pdf";
import { ProtectUI } from "./protect";
import { DecryptUI } from "./decrypt";
import { OrganiseUI } from "./organise";
import { PageNumbersUI } from "./page-numbers";
import { HeaderLayout } from "./header-layout";
import { PDFPreviewPane } from "./pdf-preview";
import { useFileListContext } from "../provider/fileListProvider";
import { KeyboardNavProvider } from "../provider/keyboardNavProvider";
import { Button } from "./ui/button";

interface MainUIProps {
  selectedTool: string;
  toolName: string;
  onBack: () => void;
}

const toolComponents: Record<string, () => any> = {
  merge: MergeUI,
  splitExtract: SplitExtractUI,
  compress: CompressUI,
  rotate: RotateUI,
  delete: DeleteUI,
  pdfToImages: PDFToImagesUI,
  imagesToPDF: ImagesToPDFUI,
  protect: ProtectUI,
  decrypt: DecryptUI,
  organise: OrganiseUI,
  pageNumbers: PageNumbersUI,
};

export function MainUI(props: MainUIProps) {
  const fl = useFileListContext();
  const [isPreviewOpen, setIsPreviewOpen] = createSignal(false);
  const terminalSize = useTerminalDimensions();

  createEffect(() => {
    if (fl.selectedFile()) {
      setIsPreviewOpen(true);
    }
    if (terminalSize().width < 50) {
      setIsPreviewOpen(false);
    }
  });

  return (
    <HeaderLayout toolName={props.toolName} onBack={props.onBack}>
      <KeyboardNavProvider>
        <box flexDirection="row">
          <box flexGrow={3}>
            <Dynamic component={toolComponents[props.selectedTool]} />
          </box>
          <Show when={props.selectedTool !== "organise" && props.selectedTool !== "decrypt"}>
            <box flexGrow={2} width={isPreviewOpen() && fl.fileCount() > 0 ? "30%" : 6}>
              <Show
                when={isPreviewOpen() && fl.fileCount() > 0}
                fallback={
                  <box alignItems="flex-start" paddingTop={2}>
                    <Button
                      disabled={!fl.selectedFile()}
                      color="yellow"
                      label="◀"
                      onClick={() => setIsPreviewOpen(true)}
                    />
                  </box>
                }
              >
                <PDFPreviewPane
                  onOpen={() => setIsPreviewOpen(true)}
                  onClose={() => setIsPreviewOpen(false)}
                />
              </Show>
            </box>
          </Show>
        </box>
      </KeyboardNavProvider>
    </HeaderLayout>
  );
}
