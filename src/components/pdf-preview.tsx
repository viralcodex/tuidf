import { TextAttributes, type BoxRenderable, type CliRenderer } from "@opentui/core";
import { onResize, useRenderer } from "@opentui/solid";
import { Show, createEffect, createMemo, createResource, createSignal, onCleanup } from "solid-js";
import {
  clearPDFPreview,
  displayPDFPreview,
  getPDFPreviewPageCount,
  getPDFPreviewViewport,
  renderPDFPreviewPage,
} from "../utils/pdf-preview";
import { useFileListContext } from "../provider/fileListProvider";
import { Button } from "./ui/button";
import { PreviewButton } from "./ui/preview-button";
import { PDFPreviewFrame } from "./ui/index";

type RendererCapabilities = CliRenderer["capabilities"];

const hasKittyGraphics = (capabilities: RendererCapabilities | null) =>
  Boolean(capabilities?.kitty_graphics);

export function PDFPreviewPane(props: { onOpen: () => void; onClose: () => void }) {
  const renderer = useRenderer();
  const fl = useFileListContext();
  const selectedFile = fl.selectedFile;
  const initialKittySupport = hasKittyGraphics(renderer.capabilities ?? null);

  const [page, setPage] = createSignal(1);
  const [layoutVersion, setLayoutVersion] = createSignal(0);
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [capabilities, setCapabilities] = createSignal<RendererCapabilities | null>(
    renderer.capabilities ?? null,
  );
  const [kittySupportDetected, setKittySupportDetected] = createSignal(initialKittySupport);
  const [capabilityProbeExpired, setCapabilityProbeExpired] = createSignal(initialKittySupport);

  const supported = createMemo(() => kittySupportDetected() || hasKittyGraphics(capabilities()));

  const [pageCount] = createResource(() => selectedFile(), getPDFPreviewPageCount);

  let frameRef: BoxRenderable | undefined;
  let requestVersion = 0;
  let activeZIndex: number | null = null;
  let latestZIndex = 0;
  let capabilityProbeTimer: ReturnType<typeof setTimeout> | null = null;
  let layoutRefreshTimer: ReturnType<typeof setTimeout> | null = null;

  const totalPages = () => Math.max(pageCount() ?? 0, 1);
  const canGoPrev = () => page() > 1;
  const canGoNext = () => page() < totalPages();
  const showSupportProbe = () =>
    Boolean(selectedFile()) && !supported() && !capabilityProbeExpired();
  const showUnsupported = () => Boolean(selectedFile()) && !supported() && capabilityProbeExpired();
  // const showLoading = () => Boolean(selectedFile()) && supported() && isLoading();
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

  const clearActivePreview = () => {
    if (activeZIndex === null) {
      return;
    }

    clearPDFPreview(renderer, activeZIndex);
    activeZIndex = null;
  };

  const cancelPendingPreviewRender = () => {
    requestVersion += 1;
  };

  const refreshPreviewLayout = () => {
    cancelPendingPreviewRender();
    clearActivePreview();

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
    setPage(1);
    setError(null);
  });

  createEffect(() => {
    const total = pageCount();
    if (total && page() > total) {
      setPage(total);
    }
  });

  createEffect(() => {
    const file = selectedFile();
    const currentPage = page();
    const pageTotal = pageCount();
    const isSupported = supported();
    layoutVersion();

    requestVersion += 1;
    const currentRequest = requestVersion;

    if (!file || !frameRef || !isSupported) {
      setIsLoading(false);
      setError(null);
      clearActivePreview();
      return;
    }

    const viewport = getPDFPreviewViewport(renderer, frameRef);

    if (!viewport) {
      setIsLoading(false);
      setError("Preview area is too small for an inline page render.");
      clearActivePreview();
      return;
    }

    setIsLoading(true);
    setError(null);

    void (async () => {
      try {
        const result = await renderPDFPreviewPage(file, currentPage, viewport);

        if (currentRequest !== requestVersion) {
          return;
        }

        const nextZIndex = ++latestZIndex;
        displayPDFPreview(
          renderer,
          viewport,
          result.width,
          result.height,
          result.png,
          nextZIndex,
          activeZIndex,
        );
        activeZIndex = nextZIndex;
        setIsLoading(false);
      } catch (previewError) {
        if (currentRequest !== requestVersion) {
          return;
        }

        clearActivePreview();
        setIsLoading(false);
        setError(
          previewError instanceof Error
            ? previewError.message
            : "Unable to render the selected PDF page.",
        );
      }
    })();

    if (pageTotal === 0) {
      setIsLoading(true);
    }
  });

  onCleanup(() => {
    renderer.off("capabilities", handleCapabilitiesChange);
    cancelPendingPreviewRender();
    clearCapabilityProbeTimer();
    clearLayoutRefreshTimer();
    clearActivePreview();
  });

  return (
    <box flexDirection="column" flexGrow={1} minHeight={0} paddingTop={2} paddingRight={1}>
      <box flexDirection="row" justifyContent="space-between" alignItems="center" flexShrink={0}>
        <text fg="#d8c7b8" attributes={TextAttributes.BOLD} content="Preview" />
        <Button color="red" label="X" onClick={props.onClose} />
      </box>
      <PDFPreviewFrame
        setFrameRef={(value: BoxRenderable | undefined) => {
          frameRef = value;
        }}
        onLayoutChange={refreshPreviewLayout}
        hasFile={Boolean(selectedFile())}
        supported={supported()}
        showSupportProbe={showSupportProbe()}
        showUnsupported={showUnsupported()}
        showError={showError()}
        errorMessage={error() ?? "Unable to render preview."}
        emptyMessage="Select a PDF to preview."
        backgroundColor="#221b18"
      />
      <Show when={selectedFile()}>
        <box
          flexDirection="row"
          alignItems="center"
          justifyContent="center"
          columnGap={1}
          paddingY={1}
        >
          <PreviewButton
            label="◀"
            disabled={!canGoPrev()}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
          />
          <box paddingBottom={1}>
            <text
              fg="#b9aaa0"
              content={`Page ${page()}/${pageCount.loading ? "..." : totalPages()}`}
            />
          </box>
          <PreviewButton
            label="▶"
            disabled={!canGoNext()}
            onClick={() => setPage((value) => Math.min(totalPages(), value + 1))}
          />
        </box>
      </Show>
    </box>
  );
}
