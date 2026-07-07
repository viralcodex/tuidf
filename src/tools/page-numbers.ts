import { StandardFonts, type PDFPage } from "pdf-lib";
import type { PageNumberPosition, PageNumbersInput, PageNumbersOutput } from "../model/models";
import { loadPdfDocumentWithPageCount, savePdfDocument } from "../utils/utils";

const MARGIN = 15;

/**
 * Adds  to the pages of a PDF file
 * @param input - Input PDF path, output path, position, and numbering options
 * @returns Result with success status and number of pages numbered
 */
export async function addPageNumbers(input: PageNumbersInput): Promise<PageNumbersOutput> {
  try {
    const { pdfDoc, totalPages } = await loadPdfDocumentWithPageCount(input.inputPath);

    let pagesToNumber: number[];

    if (input.pages === "all" || !input.pages) {
      pagesToNumber = Array.from({ length: totalPages }, (_, i) => i);
    } else {
      // Convert 1-based  to 0-based indices
      pagesToNumber = input.pages
        .filter((pageNum) => pageNum >= 1 && pageNum <= totalPages)
        .map((pageNum) => pageNum - 1);
    }

    const font = await pdfDoc.embedFont(input.font ?? StandardFonts.Helvetica);
    const fontSize = input.fontSize ?? 12;
    const startNumber = input.startNumber ?? 1;

    pagesToNumber.forEach((pageIndex, i) => {
      const page = pdfDoc.getPage(pageIndex);
      const pageNumber = String(startNumber + i);
      const textWidth = font.widthOfTextAtSize(pageNumber, fontSize);
      const { x, y } = getPageNumberCoords(page, input.position, fontSize, textWidth);
      page.drawText(pageNumber, { x, y, font: font, size: fontSize });
    });

    // Save the numbered PDF
    await savePdfDocument(pdfDoc, input.outputPath);

    return {
      success: true,
      outputPath: input.outputPath,
      numberedPages: pagesToNumber.length,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

function getPageNumberCoords(
  page: PDFPage,
  position: PageNumberPosition,
  fontSize: number,
  textWidth: number,
): { x: number; y: number } {
  const isTop = position.includes("top");
  const { width, height } = page.getSize();

  let x = MARGIN;
  if (position.endsWith("center")) x += (width - textWidth) / 2;
  if (position.endsWith("right")) x += width - textWidth - MARGIN * 2;

  const y = isTop ? height - MARGIN - fontSize : MARGIN;

  return { x, y };
}
