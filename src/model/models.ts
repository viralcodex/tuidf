import type { StandardFonts } from "pdf-lib";
import type { PreviewDocument } from "../utils/pdf-preview";

// ============ Shared Types ============
export type StatusType = "info" | "error" | "success";

export interface FocusableElement {
  id: string;
  type: "button" | "input" | "list-item" | "toggle" | "tool";
  onEnter?: () => void;
  canFocus?: () => boolean;
  onMouseDown?: () => void;
  persistent?: boolean; // keeps element registered across clearElements calls
}

export interface Status {
  msg: string;
  type: StatusType;
}

// ============ Hook Options ============
export interface FileListOptions {
  trackPageCount?: boolean;
  acceptImages?: boolean;
}

// ============ Tool Input/Output Types ============

// Compress
export interface CompressPDFInput {
  inputPath: string;
  outputPath: string;
  quality?: "low" | "medium" | "high";
}

export interface CompressPDFOutput {
  success: boolean;
  outputPath?: string;
  originalSize?: number;
  compressedSize?: number;
  compressionRatio?: string;
  error?: string;
}

// Delete
export interface DeletePagesInput {
  inputPath: string;
  outputPath: string;
  pagesToDelete: number[]; // 1-based page numbers to delete
}

export interface DeletePagesOutput {
  success: boolean;
  outputPath?: string;
  deletedPages?: number;
  remainingPages?: number;
  error?: string;
}

// Images to PDF
export interface ImagesToPDFInput {
  inputPaths: string[];
  outputPath: string;
  pageSize?: "fit" | "a4" | "letter";
}

export interface ImagesToPDFOutput {
  success: boolean;
  outputPath?: string;
  totalPages?: number;
  error?: string;
}

// Merge
export interface MergePDFsInput {
  inputPaths: string[];
  outputPath: string;
}

export interface MergePDFsOutput {
  success: boolean;
  outputPath?: string;
  error?: string;
  pageCount?: number;
}

// PDF to Images
export interface PDFToImagesInput {
  inputPath: string;
  outputDir: string;
  format?: "png" | "jpg";
  dpi?: number;
  pages?: number[] | "all";
}

export interface PDFToImagesOutput {
  success: boolean;
  outputFiles?: string[];
  totalImages?: number;
  error?: string;
}

// Protect
export interface ProtectPDFInput {
  inputPath: string;
  outputPath: string;
  userPassword?: string;
  ownerPassword?: string;
  permissions?: {
    print?: boolean;
    modify?: boolean;
    copy?: boolean;
    annotate?: boolean;
  };
}

export interface ProtectPDFOutput {
  success: boolean;
  outputPath?: string;
  error?: string;
}

// Rotate
export interface RotatePDFInput {
  inputPath: string;
  outputPath: string;
  rotation: 90 | 180 | 270; // Rotation angle in degrees (clockwise)
  pages?: number[] | "all"; // Specific pages to rotate, or 'all' for all pages
}

export interface RotatePDFOutput {
  success: boolean;
  outputPath?: string;
  rotatedPages?: number;
  error?: string;
}

export type PageNumberPosition =
  | "bottom-center"
  | "bottom-left"
  | "bottom-right"
  | "top-center"
  | "top-left"
  | "top-right";

export interface PageNumbersInput {
  inputPath: string;
  outputPath: string;
  position: PageNumberPosition;
  startNumber?: number;
  font?: StandardFonts;
  fontSize?: number;
  pages?: number[] | "all";
}

export interface PageNumbersOutput {
  success: boolean;
  outputPath?: string;
  numberedPages?: number;
  error?: string;
}

export type SplitMode = "at" | "range" | "every";

export type ExtractMode = "range" | "every";

// Split
export interface SplitPDFInput {
  inputPath: string;
  outputDir: string;
  splitMode: SplitMode;
  // For 'splitAt' mode: 3 - split into pages 1-3 and pages 4-end
  // For 'range' mode: [1, 5] - extract pages 1-5
  // For 'every' mode: 2 - split every 2 pages
  splitValue: number | number[];
}

export interface SplitPDFOutput {
  success: boolean;
  outputFiles?: string[];
  error?: string;
  totalFiles?: number;
}

//Extract
export interface ExtractPDFInput {
  inputPath: string;
  outputDir: string;
  extractMode: ExtractMode;
  extractValue: number | number[];
}

export interface ExtractPDFOutput {
  success: boolean;
  outputFiles?: string[];
  error?: string;
  totalFiles?: number;
}

// ============ Preview PDF ============
export interface PreviewButtonProps {
  label: string;
  disabled: boolean;
  onClick: () => void;
  focused?: boolean;
}

export interface PreviewStatusMessageProps {
  color: string;
  content: string;
}

export interface CachedDocument {
  doc: PreviewDocument;
  modifiedMs: number;
  pageCount: number;
}

export interface CachedPreviewImage {
  result: PDFPreviewRenderResult;
}

export interface CellPixelSize {
  width: number;
  height: number;
}

export interface PDFPreviewViewport {
  column: number;
  row: number;
  columns: number;
  rows: number;
  widthPx: number;
  heightPx: number;
  cellWidthPx: number;
  cellHeightPx: number;
}

export interface PDFPreviewRenderResult {
  pageCount: number;
  width: number;
  height: number;
  png: Uint8Array;
}

export interface KittyPlacementBase {
  column: number;
  row: number;
  offsetX: number;
  offsetY: number;
}

export interface ColumnBoundKittyPlacement extends KittyPlacementBase {
  columns: number;
}

export interface RowBoundKittyPlacement extends KittyPlacementBase {
  rows: number;
}
