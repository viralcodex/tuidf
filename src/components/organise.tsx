import {
  RGBA,
  TextAttributes,
  type BoxRenderable,
  type CliRenderer,
  type KeyEvent,
} from "@opentui/core";
import { onResize, useKeyboard, useRenderer } from "@opentui/solid";
import {
  Show,
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  type Setter,
} from "solid-js";
import { useKeyboardNav } from "../hooks/useKeyboardNav";
import { useFileListContext } from "../provider/fileListProvider";
import {
  addPagesToPdf,
  deleteOrganisePage,
  moveOrganisePage,
  saveOrganisePdf,
} from "../tools/organise";
import { deleteFileIfExists, openFile, openOutputFolder } from "../utils/utils";
import {
  clearPDFPreview,
  displayPDFPreview,
  getPDFPreviewViewport,
  renderPDFPreviewPage,
} from "../utils/pdf-preview";
import { ToolContainer } from "./ui/tool-container";
import { FileList } from "./ui/file-list";
import { ButtonRow } from "./ui/button-row";
import { Button } from "./ui/button";
import { StatusBar } from "./ui/status-bar";
import { PreviewButton } from "./ui/preview-button";
import { PDFPreviewFrame, TextInput } from "./ui/index";

type RendererCapabilities = CliRenderer["capabilities"];

type CarouselRenderSlot = "previous" | "current" | "next";

interface CarouselRenderTask {
  slot: CarouselRenderSlot;
  result: Awaited<ReturnType<typeof renderPDFPreviewPage>>;
  viewport: ReturnType<typeof getPDFPreviewViewport> extends infer T ? Exclude<T, null> : never;
}

interface OrganisePDFToolWindowProps {
  onClose: () => void;
  closeFocused: boolean;
  previewFile: Accessor<string | null>;
  totalPages: Accessor<number>;
  currentPage: Accessor<number>;
  goPrev: () => void;
  goNext: () => void;
  prevFocused: boolean;
  nextFocused: boolean;
  movePageInput: () => string;
  movePageInputFocused: boolean;
  movePageButtonFocused: boolean;
  onMovePageInput: Setter<string>;
  onMovePageFocus: () => void;
  deletePage: () => void;
  deleteFocused: boolean;
  savePdf: () => void;
  saveFocused: boolean;
  movePage: (destIndex: number) => void;
  addPages: (index: number) => void;
  addFocusedLeft: boolean;
  addFocusedRight: boolean;
}

const hasKittyGraphics = (capabilities: RendererCapabilities | null) =>
  Boolean(capabilities?.kitty_graphics);

function OrganisePDFToolWindow(props: OrganisePDFToolWindowProps) {
  const renderer = useRenderer();
  const selectedFile = props.previewFile;
  const initialKittySupport = hasKittyGraphics(renderer.capabilities ?? null);
  const [layoutVersion, setLayoutVersion] = createSignal(0);
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [capabilities, setCapabilities] = createSignal<RendererCapabilities | null>(
    renderer.capabilities ?? null,
  );
  const [kittySupportDetected, setKittySupportDetected] = createSignal(initialKittySupport);
  const [capabilityProbeExpired, setCapabilityProbeExpired] = createSignal(initialKittySupport);

  const supported = createMemo(() => kittySupportDetected() || hasKittyGraphics(capabilities()));

  let previousFrameRef: BoxRenderable | undefined;
  let currentFrameRef: BoxRenderable | undefined;
  let nextFrameRef: BoxRenderable | undefined;
  let requestVersion = 0;
  let previousZIndex: number | null = null;
  let currentZIndex: number | null = null;
  let nextZIndex: number | null = null;
  let latestZIndex = 0;
  let capabilityProbeTimer: ReturnType<typeof setTimeout> | null = null;
  let layoutRefreshTimer: ReturnType<typeof setTimeout> | null = null;

  const totalPages = props.totalPages;
  const currentPage = props.currentPage;
  const previousPage = () => currentPage() - 1;
  const nextPage = () => currentPage() + 1;
  const hasPreviousPage = () => previousPage() >= 1;
  const hasNextPage = () => nextPage() <= totalPages();
  const canGoPrev = () => hasPreviousPage();
  const canGoNext = () => hasNextPage();
  const showSupportProbe = () =>
    Boolean(selectedFile()) && !supported() && !capabilityProbeExpired();
  const showUnsupported = () => Boolean(selectedFile()) && !supported() && capabilityProbeExpired();
  const showLoading = () => Boolean(selectedFile()) && supported() && isLoading();
  const showError = () =>
    Boolean(selectedFile()) && supported() && !isLoading() && Boolean(error());

  const invalidateLayout = () => {
    setLayoutVersion((value) => value + 1);
  };

  const clearCapabilityProbeTimer = () => {
    if (capabilityProbeTimer !== null) {
      clearTimeout(capabilityProbeTimer);
      capabilityProbeTimer = null;
    }
  };

  const clearLayoutRefreshTimer = () => {
    if (layoutRefreshTimer !== null) {
      clearTimeout(layoutRefreshTimer);
      layoutRefreshTimer = null;
    }
  };

  const clearPreviousPreview = () => {
    if (previousZIndex === null) {
      return;
    }

    clearPDFPreview(renderer, previousZIndex);
    previousZIndex = null;
  };

  const clearCurrentPreview = () => {
    if (currentZIndex === null) {
      return;
    }

    clearPDFPreview(renderer, currentZIndex);
    currentZIndex = null;
  };

  const clearNextPreview = () => {
    if (nextZIndex === null) {
      return;
    }

    clearPDFPreview(renderer, nextZIndex);
    nextZIndex = null;
  };

  const clearCarouselPreviews = () => {
    clearPreviousPreview();
    clearCurrentPreview();
    clearNextPreview();
  };

  const cancelPendingPreviewRender = () => {
    requestVersion += 1;
  };

  const refreshPreviewLayout = () => {
    cancelPendingPreviewRender();
    clearCarouselPreviews();

    clearLayoutRefreshTimer();
    layoutRefreshTimer = setTimeout(() => {
      layoutRefreshTimer = null;
      invalidateLayout();
    }, 0);
  };

  onResize(() => {
    refreshPreviewLayout();
  });

  const handleCapabilitiesChange = (nextCapabilities: unknown) => {
    const resolvedCapabilities =
      (nextCapabilities as RendererCapabilities | null | undefined) ?? null;

    setCapabilities(resolvedCapabilities);

    if (hasKittyGraphics(resolvedCapabilities)) {
      setKittySupportDetected(true);
      setCapabilityProbeExpired(true);
      clearCapabilityProbeTimer();
    }

    refreshPreviewLayout();
  };

  renderer.on("capabilities", handleCapabilitiesChange);

  createEffect(() => {
    if (supported()) {
      clearCapabilityProbeTimer();

      if (!capabilityProbeExpired()) {
        setCapabilityProbeExpired(true);
      }

      return;
    }

    if (capabilityProbeExpired() || capabilityProbeTimer !== null) {
      return;
    }

    capabilityProbeTimer = setTimeout(() => {
      capabilityProbeTimer = null;
      setCapabilityProbeExpired(true);
      refreshPreviewLayout();
    }, 1500);
  });

  createEffect(() => {
    selectedFile();
    setError(null);
  });

  createEffect(() => {
    const file = selectedFile();
    const activePage = currentPage();
    const leftNeighborPage = previousPage();
    const rightNeighborPage = nextPage();
    const total = totalPages();
    const isSupported = supported();
    layoutVersion();

    requestVersion += 1;
    const currentRequest = requestVersion;

    if (!file || !previousFrameRef || !currentFrameRef || !nextFrameRef || !isSupported) {
      setIsLoading(false);
      setError(null);
      clearCarouselPreviews();
      return;
    }

    const previousViewport = getPDFPreviewViewport(renderer, previousFrameRef);
    const currentViewport = getPDFPreviewViewport(renderer, currentFrameRef);
    const nextViewport = getPDFPreviewViewport(renderer, nextFrameRef);

    if (!previousViewport || !currentViewport || !nextViewport) {
      setIsLoading(false);
      setError("Carousel preview area is too small for inline page rendering.");
      clearCarouselPreviews();
      return;
    }

    setIsLoading(true);
    setError(null);

    void (async () => {
      try {
        const renders: Promise<CarouselRenderTask>[] = [
          renderPDFPreviewPage(file, activePage, currentViewport).then((result) => ({
            slot: "current" as const,
            result,
            viewport: currentViewport,
          })),
        ];

        if (leftNeighborPage >= 1) {
          renders.push(
            renderPDFPreviewPage(file, leftNeighborPage, previousViewport).then((result) => ({
              slot: "previous" as const,
              result,
              viewport: previousViewport,
            })),
          );
        }

        if (rightNeighborPage <= total) {
          renders.push(
            renderPDFPreviewPage(file, rightNeighborPage, nextViewport).then((result) => ({
              slot: "next" as const,
              result,
              viewport: nextViewport,
            })),
          );
        }

        const results = await Promise.all(renders);

        if (currentRequest !== requestVersion) {
          return;
        }

        let renderedPreviousPage = false;
        let renderedNextPage = false;

        results.forEach(({ slot, result, viewport }) => {
          const nextLayer = ++latestZIndex;

          if (slot === "previous") {
            displayPDFPreview(
              renderer,
              viewport,
              result.width,
              result.height,
              result.png,
              nextLayer,
              previousZIndex,
            );
            previousZIndex = nextLayer;
            renderedPreviousPage = true;
            return;
          }

          if (slot === "current") {
            displayPDFPreview(
              renderer,
              viewport,
              result.width,
              result.height,
              result.png,
              nextLayer,
              currentZIndex,
            );
            currentZIndex = nextLayer;
            return;
          }

          displayPDFPreview(
            renderer,
            viewport,
            result.width,
            result.height,
            result.png,
            nextLayer,
            nextZIndex,
          );
          nextZIndex = nextLayer;
          renderedNextPage = true;
        });

        if (!renderedPreviousPage) {
          clearPreviousPreview();
        }

        if (!renderedNextPage) {
          clearNextPreview();
        }

        setIsLoading(false);
      } catch (previewError) {
        if (currentRequest !== requestVersion) {
          return;
        }

        clearCarouselPreviews();
        setIsLoading(false);
        setError(
          previewError instanceof Error
            ? previewError.message
            : "Unable to render the selected PDF page.",
        );
      }
    })();
  });

  // Cleanup on unmount
  onCleanup(() => {
    renderer.off("capabilities", handleCapabilitiesChange);
    cancelPendingPreviewRender();
    clearCapabilityProbeTimer();
    clearLayoutRefreshTimer();
    clearCarouselPreviews();
  });

  return (
    <box flexDirection="column" flexGrow={1} rowGap={1} width={`100%`}>
      <box flexDirection="row" justifyContent="space-between" alignItems="center" width={`100%`}>
        <Button label="X" color="red" onClick={props.onClose} focused={props.closeFocused} />
      </box>
      <box flexDirection="row" columnGap={2} flexGrow={1} alignItems="stretch">
        <box flexDirection="column" width={`100%`}>
          <box justifyContent="center" alignItems="center" height={1}>
            <text fg="#4f565d" content={hasPreviousPage() ? `Page ${previousPage()}` : "End"} />
          </box>
          <box flexGrow={1} alignItems="center" justifyContent="center">
            <PDFPreviewFrame
              setFrameRef={(value: BoxRenderable | undefined) => {
                previousFrameRef = value;
              }}
              onLayoutChange={refreshPreviewLayout}
              hasFile={Boolean(selectedFile())}
              supported={supported()}
              showSupportProbe={showSupportProbe()}
              showUnsupported={showUnsupported()}
              showError={showError()}
              errorMessage={error() ?? "Unable to render preview."}
              emptyMessage="Select a PDF to organise."
              border={false}
              backgroundColor="#161616"
              width="72%"
              height="68%"
              minHeight={9}
              alignItems="center"
              justifyContent="center"
            >
              <Show when={selectedFile() && supported() && !showError() && hasPreviousPage()}>
                <box
                  position="absolute"
                  top={0}
                  right={0}
                  bottom={0}
                  left={0}
                  backgroundColor={RGBA.fromInts(18, 18, 18, 128)}
                />
              </Show>
              <Show when={selectedFile() && supported() && !showError() && !hasPreviousPage()}>
                <text fg="#5f6770" content="No previous page" />
              </Show>
            </PDFPreviewFrame>
          </box>
        </box>
        <box border={["left"]} borderColor="#34495e" width={1}></box>
        <box flexDirection="column" flexGrow={6} rowGap={1} width={`200%`}>
          <box justifyContent="center" alignItems="center">
            <text fg="#d8c7b8" attributes={TextAttributes.BOLD} content={`Page ${currentPage()}`} />
          </box>
          <PDFPreviewFrame
            setFrameRef={(value: BoxRenderable | undefined) => {
              currentFrameRef = value;
            }}
            onLayoutChange={refreshPreviewLayout}
            hasFile={Boolean(selectedFile())}
            supported={supported()}
            showSupportProbe={showSupportProbe()}
            showUnsupported={showUnsupported()}
            showLoading={showLoading()}
            loadingMessage="Rendering page preview..."
            showError={showError()}
            errorMessage={error() ?? "Unable to render preview."}
            emptyMessage="Select a PDF to organise."
            border={false}
            backgroundColor="#f5f5f5"
            minHeight={18}
            alignItems="center"
            justifyContent="center"
          />
        </box>
        <box border={["left"]} borderColor="#34495e" width={1}></box>
        <box flexDirection="column" flexGrow={1} rowGap={0} width={`100%`}>
          <box justifyContent="center" alignItems="center" height={1}>
            <text fg="#4f565d" content={hasNextPage() ? `Page ${nextPage()}` : "End"} />
          </box>
          <box flexGrow={1} alignItems="center" justifyContent="center">
            <PDFPreviewFrame
              setFrameRef={(value: BoxRenderable | undefined) => {
                nextFrameRef = value;
              }}
              onLayoutChange={refreshPreviewLayout}
              hasFile={Boolean(selectedFile())}
              supported={supported()}
              showSupportProbe={showSupportProbe()}
              showUnsupported={showUnsupported()}
              showError={showError()}
              errorMessage={error() ?? "Unable to render preview."}
              emptyMessage="Select a PDF to organise."
              border={false}
              backgroundColor="#161616"
              width="72%"
              height="68%"
              minHeight={9}
              alignItems="center"
              justifyContent="center"
            >
              <Show when={selectedFile() && supported() && !showError() && hasNextPage()}>
                <box
                  position="absolute"
                  top={0}
                  right={0}
                  bottom={0}
                  left={0}
                  backgroundColor={RGBA.fromInts(18, 18, 18, 128)}
                />
              </Show>
              <Show when={selectedFile() && supported() && !showError() && !hasNextPage()}>
                <text fg="#5f6770" content="No next page" />
              </Show>
            </PDFPreviewFrame>
          </box>
        </box>
      </box>
      <Show when={selectedFile()}>
        <box
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          marginTop={1}
          width={"100%"}
        >
          <box flexDirection="row" alignItems="center" justifyContent="center" width={"100%"}>
            <box width={"25%"} alignItems="flex-end" marginLeft={14}>
              <Button
                label="+ Add Page(s)"
                color="green"
                onClick={() => props.addPages(previousPage())}
                width={"50%"}
                focused={props.addFocusedLeft}
              />
            </box>
            <box
              width={"45%"}
              flexDirection="row"
              alignItems="center"
              justifyContent="center"
              columnGap={2}
            >
              <PreviewButton
                label="◀"
                disabled={!canGoPrev()}
                onClick={props.goPrev}
                focused={props.prevFocused}
              />
              <text fg="#b9aaa0" content={`Page ${currentPage()}/${totalPages()}`} />
              <PreviewButton
                label="▶"
                disabled={!canGoNext()}
                onClick={props.goNext}
                focused={props.nextFocused}
              />
            </box>
            <box width={"25%"} alignItems="flex-start" marginRight={14}>
              <Button
                label="+ Add Page(s)"
                color="green"
                onClick={() => props.addPages(nextPage() - 1)}
                width={"50%"}
                focused={props.addFocusedRight}
              />
            </box>
          </box>
          <box
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            flexGrow={1}
            width={"100%"}
          >
            <box width={"25%"} flexDirection="row" alignItems="center" justifyContent="center">
              <TextInput
                label="Move page to"
                value={props.movePageInput}
                focused={props.movePageInputFocused}
                onFocus={props.onMovePageFocus}
                onInput={props.onMovePageInput}
                width={"100%"}
              />
            </box>
            <box flexDirection="column" alignItems="center" justifyContent="center" width={"25%"}>
              <box
                flexDirection="row"
                alignItems="center"
                justifyContent="center"
                width={"100%"}
                columnGap={2}
                marginTop={1}
              >
                <box flexGrow={1} alignItems="stretch">
                  <Button
                    label="Move Page"
                    color="cyan"
                    onClick={() => props.movePage(Number(props.movePageInput()))}
                    focused={props.movePageButtonFocused}
                    width={"100%"}
                  />
                </box>
                <box flexGrow={1} alignItems="stretch">
                  <Button
                    label="Delete Page"
                    color="red"
                    onClick={props.deletePage}
                    focused={props.deleteFocused}
                    width={"100%"}
                  />
                </box>
              </box>
              <Button
                label="Save PDF"
                color="green"
                onClick={props.savePdf}
                focused={props.saveFocused}
                width={"100%"}
                marginTop={1}
              />
            </box>
          </box>
        </box>
      </Show>
    </box>
  );
}

export function OrganiseUI() {
  const fl = useFileListContext();
  const nav = useKeyboardNav();
  const [isToolWindowOpen, setIsToolWindowOpen] = createSignal(false);
  const openToolWindow = () => setIsToolWindowOpen(true);
  const [focusedInput, setFocusedInput] = createSignal<string | null>(null);
  const [currentPage, setCurrentPage] = createSignal(1);
  const [movePageInput, setMovePageInput] = createSignal("");
  const [workingFilePath, setWorkingFilePath] = createSignal<string | null>(null);
  const [workingPageCount, setWorkingPageCount] = createSignal(0);

  const previewFile = createMemo(() => workingFilePath() ?? fl.selectedFile());
  const totalPages = createMemo(() => (workingFilePath() ? workingPageCount() : fl.pageCount()));
  const activePage = currentPage;

  createEffect(() => {
    nav.clearElements();

    if (isToolWindowOpen()) {
      nav.registerElement({
        id: "close-organise-btn",
        type: "button",
        onEnter: closeToolWindow,
      });

      nav.registerElement({
        id: "add-page-btn-left",
        type: "button",
        onEnter: () => addPages(currentPage() - 1),
        canFocus: () => Boolean(fl.selectedFile()),
      });

      nav.registerElement({
        id: "add-page-btn-right",
        type: "button",
        onEnter: () => addPages(currentPage()),
        canFocus: () => Boolean(fl.selectedFile()),
      });

      nav.registerElement({
        id: "organise-prev-btn",
        type: "button",
        onEnter: goPrev,
        canFocus: () => currentPage() > 1,
      });

      nav.registerElement({
        id: "organise-next-btn",
        type: "button",
        onEnter: goNext,
        canFocus: () => currentPage() < totalPages(),
      });

      nav.registerElement({
        id: "move-page-input",
        type: "input",
        onEnter: () => setFocusedInput("move-page-input"),
        canFocus: () => Boolean(fl.selectedFile()),
      });

      nav.registerElement({
        id: "move-page-btn",
        type: "button",
        onEnter: () => movePage(Number(movePageInput())),
        canFocus: () => Boolean(fl.selectedFile()),
      });

      nav.registerElement({
        id: "delete-page-btn",
        type: "button",
        onEnter: deletePage,
        canFocus: () => Boolean(fl.selectedFile()),
      });

      nav.registerElement({
        id: "save-pdf-btn",
        type: "button",
        onEnter: savePdf,
        canFocus: () => Boolean(fl.selectedFile()),
      });

      return;
    }

    // Register file list items and their action buttons
    fl.files().forEach((_, index) => {
      nav.registerElement({
        id: `file-${index}`,
        type: "list-item",
        onEnter: () => {
          fl.selectFile(index);
          openToolWindow();
        },
      });

      nav.registerElement({
        id: `file-${index}-open`,
        type: "button",
        onEnter: () => openFile(fl.files()[index]!),
      });

      // Move up button
      nav.registerElement({
        id: `file-${index}-up`,
        type: "button",
        onEnter: () => fl.moveFile(index, "up"),
        canFocus: () => index > 0,
      });

      // Move down button
      nav.registerElement({
        id: `file-${index}-down`,
        type: "button",
        onEnter: () => fl.moveFile(index, "down"),
        canFocus: () => index < fl.fileCount() - 1,
      });

      // Remove button
      nav.registerElement({
        id: `file-${index}-remove`,
        type: "button",
        onEnter: () => fl.removeFile(index),
      });
    });

    nav.registerElement({
      id: "open-output-btn",
      type: "button",
      onEnter: () =>
        openOutputFolder().catch((_) =>
          fl.setStatus({ msg: "Failed to open folder", type: "error" }),
        ),
    });

    nav.registerElement({
      id: "open-organise-btn",
      type: "button",
      onEnter: openToolWindow,
      canFocus: () => fl.fileCount() > 0,
    });
  });

  createEffect(() => {
    nav.setIsInputMode(focusedInput() !== null);
  });

  createEffect(() => {
    if (!nav.isInputMode()) {
      setFocusedInput(null);
    }
  });

  createEffect(() => {
    const selected = fl.selectedFile();

    setWorkingFilePath(null);
    setWorkingPageCount(0);

    if (!selected) {
      setCurrentPage(1);
      setMovePageInput("");
      return;
    }

    setCurrentPage(1);

    if (focusedInput() !== "move-page-input") {
      setMovePageInput("1");
    }
  });

  createEffect(() => {
    const total = Math.max(totalPages(), 1);
    const clampedPage = Math.min(Math.max(currentPage(), 1), total);

    if (clampedPage !== currentPage()) {
      setCurrentPage(clampedPage);
    }

    if (focusedInput() !== "move-page-input") {
      setMovePageInput(String(clampedPage));
    }
  });

  onCleanup(() => {
    nav.clearElements();
    void cleanupWorkingDraft();
  });

  const cleanupWorkingDraft = async () => {
    const draftPath = workingFilePath();

    setWorkingFilePath(null);
    setWorkingPageCount(0);

    await deleteFileIfExists(draftPath);
  };

  const closeToolWindow = () => {
    setCurrentPage(1);
    setMovePageInput("");
    setIsToolWindowOpen(false);
  };

  const goPrev = () => {
    if (activePage() <= 1) {
      nav.focusById("organise-next-btn");
      return;
    }

    const nextPage = activePage() - 1;
    setCurrentPage(nextPage);

    if (nextPage <= 1) {
      nav.focusById("organise-next-btn");
      return;
    }
    nav.focusById("organise-prev-btn");
  };

  const goNext = () => {
    if (activePage() >= totalPages()) {
      nav.focusById("organise-prev-btn");
      return;
    }

    const nextPage = activePage() + 1;
    setCurrentPage(nextPage);

    if (nextPage >= totalPages()) {
      nav.focusById("organise-prev-btn");
      return;
    }
    nav.focusById("organise-next-btn");
  };

  const savePdf = async () => {
    const file = previewFile();

    if (!file || fl.isProcessing()) {
      return;
    }

    fl.setIsProcessing(true);
    fl.setStatus({ msg: "Saving PDF...", type: "info" });

    try {
      const result = await saveOrganisePdf({
        inputPath: file,
        originalInputPath: fl.selectedFile(),
        workingFilePath: workingFilePath(),
      });

      if (!result.success || !result.outputPath) {
        fl.setStatus({
          msg: result.error || "Failed to save PDF",
          type: "error",
        });
        return;
      }

      fl.setStatus({ msg: "PDF saved successfully", type: "success" });
      await openFile(result.outputPath);
    } catch (error) {
      fl.setStatus({
        msg: error instanceof Error ? error.message : "Unable to save PDF",
        type: "error",
      });
    } finally {
      fl.setIsProcessing(false);
    }
  };

  const deletePage = async () => {
    const file = previewFile();

    if (!file || fl.isProcessing()) {
      return;
    }

    if (totalPages() <= 1) {
      fl.setStatus({ msg: "Cannot delete the last page", type: "error" });
      return;
    }

    const pageToDelete = currentPage();

    fl.setIsProcessing(true);
    fl.setStatus({ msg: `Deleting page ${pageToDelete}...`, type: "info" });

    try {
      const result = await deleteOrganisePage({
        inputPath: file,
        originalInputPath: fl.selectedFile(),
        workingFilePath: workingFilePath(),
        pageToDelete,
        totalPages: totalPages(),
      });

      if (!result.success) {
        fl.setStatus({
          msg: result.error || "Unable to delete page",
          type: "error",
        });
        return;
      }

      setWorkingFilePath(result.draftPath ?? null);

      const nextTotalPages = result.remainingPages ?? Math.max(totalPages() - 1, 1);
      setWorkingPageCount(nextTotalPages);

      const nextPage = result.nextPage ?? Math.min(pageToDelete, nextTotalPages);
      setCurrentPage(nextPage);

      // if (focusedInput() !== "move-page-input") {
      //   setMovePageInput(String(nextPage));
      // }

      fl.setStatus({
        msg: `Deleted page ${pageToDelete}. ${nextTotalPages} page(s) remaining`,
        type: "success",
      });
    } catch (error) {
      fl.setStatus({
        msg: error instanceof Error ? error.message : "Unable to delete page",
        type: "error",
      });
    } finally {
      fl.setIsProcessing(false);
    }
  };

  const movePage = async (destIndex: number) => {
    const file = previewFile();

    if (!file || fl.isProcessing()) {
      return;
    }

    if (!Number.isInteger(destIndex) || destIndex < 1 || destIndex > totalPages()) {
      fl.setStatus({ msg: "Invalid destination page index", type: "error" });
      return;
    }

    const sourceIndex = currentPage();

    if (sourceIndex === destIndex) {
      fl.setStatus({
        msg: "Choose a different destination page",
        type: "error",
      });
      return;
    }

    fl.setIsProcessing(true);
    fl.setStatus({
      msg: `Moving page ${sourceIndex} to ${destIndex}...`,
      type: "info",
    });

    try {
      const result = await moveOrganisePage({
        inputPath: file,
        originalInputPath: fl.selectedFile(),
        workingFilePath: workingFilePath(),
        sourceIndex,
        destIndex,
        totalPages: totalPages(),
      });

      if (!result.success) {
        fl.setStatus({
          msg: result.error || "Unable to move page",
          type: "error",
        });
        return;
      }

      setWorkingFilePath(result.draftPath ?? null);

      const nextTotalPages = result.totalPages ?? totalPages();
      setWorkingPageCount(nextTotalPages);

      const nextPage = result.currentPage ?? destIndex;
      setCurrentPage(nextPage);
      setMovePageInput(String(nextPage));

      fl.setStatus({
        msg: `Moved page ${result.sourceIndex ?? sourceIndex} to ${result.destIndex ?? destIndex}`,
        type: "success",
      });
    } catch (error) {
      fl.setStatus({
        msg: error instanceof Error ? error.message : "Unable to move page",
        type: "error",
      });
    } finally {
      fl.setIsProcessing(false);
    }
  };

  const addPages = async (index: number) => {
    const file = previewFile();

    if (!file || fl.isProcessing()) {
      return;
    }

    fl.setIsProcessing(true);
    fl.setStatus({ msg: `Adding page at position ${index}...`, type: "info" });

    try {
      const result = await addPagesToPdf({
        pageIndex: index,
        inputPath: file,
        originalInputPath: fl.selectedFile(),
        workingFilePath: workingFilePath(),
      });

      if (!result) return;

      if (!result.success) {
        fl.setStatus({
          msg: result.error || "Unable to add page",
          type: "error",
        });
        return;
      }

      setWorkingFilePath(result.draftPath ?? null);

      const nextTotalPages = result.totalPages ?? totalPages();
      setWorkingPageCount(nextTotalPages);

      const nextPage = result.currentPage ?? index;
      setCurrentPage(nextPage);
      setMovePageInput(String(nextPage));

      fl.setStatus({
        msg: `Added page at position ${index}. Total pages: ${nextTotalPages}`,
        type: "success",
      });
    } catch (error) {
      fl.setStatus({
        msg: error instanceof Error ? error.message : "Unable to add page",
        type: "error",
      });
    } finally {
      fl.setIsProcessing(false);
    }
  };

  useKeyboard((event: KeyEvent) => {
    if (!isToolWindowOpen() || nav.isInputMode() || !fl.selectedFile()) {
      return;
    }

    if (event.name === "left") {
      goPrev();
      return;
    }

    if (event.name === "right") {
      goNext();
    }
  });

  return (
    <ToolContainer paddingTop={1}>
      <box flexDirection="row" justifyContent="center" alignItems="center" width={`100%`}>
        <box flexDirection="column" alignItems="center" justifyContent="center">
          <text
            fg="#d8c7b8"
            attributes={TextAttributes.BOLD}
            content="Reorder, Delete or Add pages in a PDF"
          />
          <Show when={!isToolWindowOpen()}>
            <text
              fg="#d8c7b8"
              attributes={TextAttributes.BOLD}
              content="(double click/enter on a file to open the tool)"
            />
          </Show>
        </box>
      </box>
      <Show when={!isToolWindowOpen()}>
        <FileList
          header="Files"
          files={fl.files}
          fileType="pdf"
          selectedIndex={fl.selectedIndex}
          onSelect={fl.selectFile}
          onDoubleClick={async (index) => {
            await fl.selectFile(index);
            openToolWindow();
          }}
          onFocusIndex={(index) => nav.focusById(`file-${index}`)}
          onRemove={fl.removeFile}
          onMove={fl.moveFile}
          onFilesSelected={async (paths) => {
            await fl.addFilesToList(paths);
          }}
          showReorder={true}
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
      </Show>
      <Show when={isToolWindowOpen()}>
        <OrganisePDFToolWindow
          onClose={closeToolWindow}
          closeFocused={nav.isFocused("close-organise-btn")}
          previewFile={previewFile}
          totalPages={totalPages}
          currentPage={currentPage}
          goPrev={goPrev}
          goNext={goNext}
          prevFocused={nav.isFocused("organise-prev-btn")}
          nextFocused={nav.isFocused("organise-next-btn")}
          movePageInputFocused={
            focusedInput() === "move-page-input" || nav.isFocused("move-page-input")
          }
          movePageButtonFocused={nav.isFocused("move-page-btn")}
          movePageInput={movePageInput}
          onMovePageInput={setMovePageInput}
          deletePage={deletePage}
          deleteFocused={nav.isFocused("delete-page-btn")}
          savePdf={savePdf}
          saveFocused={nav.isFocused("save-pdf-btn")}
          movePage={movePage}
          onMovePageFocus={() => setFocusedInput("move-page-input")}
          addPages={addPages}
          addFocusedLeft={nav.isFocused("add-page-btn-left")}
          addFocusedRight={nav.isFocused("add-page-btn-right")}
        />
      </Show>
      <ButtonRow>
        <Show when={!isToolWindowOpen()}>
          <Button
            label="Organise Pages"
            color="cyan"
            disabled={fl.fileCount() === 0}
            onClick={openToolWindow}
            focused={nav.isFocused("open-organise-btn")}
          />
          <Button
            label="Open Output Folder"
            color="output"
            onClick={() =>
              openOutputFolder().catch((_) =>
                fl.setStatus({
                  msg: "Failed to open folder",
                  type: "error",
                }),
              )
            }
            focused={nav.isFocused("open-output-btn")}
          />
        </Show>
      </ButtonRow>
      <StatusBar message={fl.status().msg} type={fl.status().type} />
    </ToolContainer>
  );
}
