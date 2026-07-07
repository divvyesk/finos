import pdf from 'pdf-parse/lib/pdf-parse.js';

/**
 * Stage 1A — PDF Extractor
 *
 * Takes a Node.js Buffer of a PDF file and returns the raw text content.
 *
 * Uses pdf-parse's internal module (not index.js) to avoid the top-level
 * self-test debug code that fires in Next.js/Turbopack builds.
 *
 * Options used:
 *   - max: 0        — Do not render any pages to images. Text-only mode.
 *                     This removes the pdfjs rendering pipeline entirely,
 *                     which is what causes "bad XRef entry" on malformed PDFs.
 *   - version: 'v1.10.100' — Pin to a stable pdfjs worker version.
 */
const PDF_OPTIONS = {
  max: 0, // disable page rendering — text extraction only
};

export async function extractTextFromPDF(buffer) {
  // First pass: try with lenient options
  try {
    const result = await pdf(buffer, PDF_OPTIONS);
    const text = result.text?.trim() || '';

    if (!text || text.length === 0) {
      throw new Error(
        'PDF parsed successfully but contained no extractable text. ' +
        'This is likely a scanned PDF — re-upload as a PNG or JPG image instead.'
      );
    }

    return {
      text,
      confidence: 0.98,
      pageCount: result.numpages,
      method: 'pdf-parse'
    };
  } catch (firstErr) {
    // Second pass: try with no options at all (bare call)
    // Some PDFs fail with options but work with defaults
    console.warn(`[pdfExtractor] First parse attempt failed, retrying with defaults: ${firstErr.message}`);
    try {
      const result = await pdf(buffer);
      const text = result.text?.trim() || '';

      if (!text || text.length === 0) {
        throw new Error(
          'PDF parsed successfully but contained no extractable text. ' +
          'This is likely a scanned PDF — re-upload as a PNG or JPG image instead.'
        );
      }

      return {
        text,
        confidence: 0.97,
        pageCount: result.numpages,
        method: 'pdf-parse (fallback)'
      };
    } catch (secondErr) {
      console.error('[pdfExtractor] Both parse attempts failed:', secondErr.message);
      throw new Error(
        `Could not extract text from this PDF. Reason: ${secondErr.message}. ` +
        `If this is a scanned document, try uploading it as a PNG or JPG image instead.`
      );
    }
  }
}
