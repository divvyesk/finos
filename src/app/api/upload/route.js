import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { extractTextFromPDF } from '../../lib/extractors/pdfExtractor';
import { extractTextFromImage } from '../../lib/extractors/imageExtractor';
import { extractAllFields } from '../../lib/extractors/fieldExtractor';
import { validateExtractedData } from '../../lib/extractors/validator';
import { getData, saveData } from '../../lib/db';

/**
 * POST /api/upload
 *
 * Orchestrates the 3-stage Income Intake pipeline:
 *
 * Stage 1 — Raw text extraction
 *   PDF  → pdfExtractor  (pdf-parse / pdfjs-dist)
 *   IMG  → imageExtractor (tesseract.js WebAssembly OCR)
 *
 * Stage 2 — Structured field extraction
 *   rawText → fieldExtractor (regex per field)
 *
 * Stage 3 — Validation
 *   structuredData → validator (deterministic rules)
 *
 * Manual entry bypasses Stages 1 & 2 entirely.
 * The client sends JSON with pre-filled fields → goes straight to Stage 3.
 */
export async function POST(request) {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('session')?.value;
    const userId = sessionId || 'anonymous';

    const contentType = request.headers.get('content-type') || '';

    let structuredData = {};
    let rawTextPreview = null;
    let ocrConfidence = null;
    let extractionMethod = null;
    let source = '';

    // ── BRANCH A: File Upload ────────────────────────────────────────────────
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file');

      if (!file) {
        return NextResponse.json({ error: 'No file found in upload.' }, { status: 400 });
      }

      source = `File: ${file.name} (${file.type})`;
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Stage 1 — pick extractor based on MIME type
      let stage1Result;
      if (file.type === 'application/pdf') {
        try {
          stage1Result = await extractTextFromPDF(buffer);
        } catch (pdfErr) {
          console.warn('[upload] PDF parsing failed:', pdfErr.message);
          return NextResponse.json(
            {
              error: `PDF parsing failed (e.g. bad XRef entry / corrupted structure). If this is a scanned document, please try converting it to a PNG or JPG image and upload it again.`
            },
            { status: 400 }
          );
        }
      } else if (file.type.startsWith('image/')) {
        stage1Result = await extractTextFromImage(buffer);
      } else {
        return NextResponse.json(
          { error: `Unsupported file type: ${file.type}. Upload a PDF, PNG, or JPG.` },
          { status: 400 }
        );
      }

      ocrConfidence = stage1Result.confidence;
      extractionMethod = stage1Result.method;
      rawTextPreview = stage1Result.text.substring(0, 400);

      // Stage 2 — extract structured fields from raw text
      structuredData = await extractAllFields(stage1Result.text);
    }

    // ── BRANCH B: Manual Entry ───────────────────────────────────────────────
    else {
      const body = await request.json();
      source = 'Manual Entry';
      ocrConfidence = 1.0; // perfect confidence — user typed it directly
      extractionMethod = 'manual';
      rawTextPreview = null;

      structuredData = {
        country: body.country || 'US',
        currency: body.currency || 'USD',
        state: body.state || null,
        salary: body.salary ? Number(body.salary) : null,
        signing_bonus: body.signing_bonus ? Number(body.signing_bonus) : null,
        relocation_bonus: body.relocation_bonus ? Number(body.relocation_bonus) : null,
        rsu_count: body.rsu_count ? Number(body.rsu_count) : null,
        vesting_period_years: body.vesting_period_years ? Number(body.vesting_period_years) : null,
        stock_options: body.stock_options ? Number(body.stock_options) : null,
        pay_frequency: body.pay_frequency || null,
        start_date: body.start_date || null,
        location: body.location || null,
        employment_type: body.employment_type || 'full_time',
        retirement_401k: body.match_rate != null
          ? { match_rate: Number(body.match_rate), match_limit: Number(body.match_limit) }
          : null,
        health_insurance: {
          medical: !!body.health_medical,
          dental: !!body.health_dental,
          vision: !!body.health_vision,
        },
        pto_days: body.pto_days ? Number(body.pto_days) : null,
        probation_period_days: body.probation_period_days ? Number(body.probation_period_days) : null,
      };
    }

    // Stage 3 — validate
    const validation = await validateExtractedData(structuredData);

    const payload = {
      success: true,
      source,
      ocrConfidence,
      extractionMethod,
      rawTextPreview,
      data: structuredData,
      validation,
    };

    // Persist to db.json
    const db = getData();
    db.uploads.push({
      userId,
      timestamp: new Date().toISOString(),
      source,
      ocrConfidence,
      extractionMethod,
      data: structuredData,
      validation,
    });
    saveData(db);

    return NextResponse.json(payload);
  } catch (err) {
    console.error('[/api/upload] Pipeline error:', err.message);
    return NextResponse.json(
      { error: err.message || 'An unexpected error occurred during document processing.' },
      { status: 500 }
    );
  }
}
