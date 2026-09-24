import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import {
  ContractExtractionSchema, PaymentExtractionSchema, CorrespondenceExtractionSchema,
  QualityExtractionSchema, DrawingExtractionSchema, UnclassifiableExtractionSchema,
} from './pending-review-schema.mjs';

const MODEL = 'claude-opus-5';

const SYSTEM_PROMPT = `You are extracting structured data from one scanned, Mongolian-language \
construction-project document for the "HEIWA RESIDENCE & CARE HOME" archive. Documents are \
contracts, payment/financing reports, correspondence (letters/RFIs), quality or defect records, \
or drawing-register entries.

Classify the document by calling exactly one of the record_* tools — record_contracts, \
record_payments, record_correspondence, record_quality, record_drawings, or record_unclassifiable \
(use this only if the document doesn't fit any of the above, or is unreadable). Always answer with \
that one tool call.

Only extract what is actually printed in the document — never guess or estimate a financial \
figure. Use null for anything not present or not legible. Dates must be ISO format (YYYY-MM-DD). \
Amounts must be the plain number with no currency symbol or thousands separators.`;

const COLLECTIONS = {
  contracts: [ContractExtractionSchema, 'A contract or contract amendment.'],
  payments: [PaymentExtractionSchema, 'A payment, invoice or financing/progress-payment report.'],
  correspondence: [CorrespondenceExtractionSchema, 'A letter, RFI or other correspondence.'],
  quality: [QualityExtractionSchema, 'A quality, inspection or defect record.'],
  drawings: [DrawingExtractionSchema, 'A drawing-register entry or drawing package.'],
  unclassifiable: [UnclassifiableExtractionSchema, 'Fits none of the other collections, or is unreadable.'],
};

/**
 * One tool per target collection: Claude classifies the document by which
 * tool it calls, and the tool input carries that collection's fields.
 *
 * Tools rather than output_config.format, because structured outputs caps a
 * schema at 16 union-typed parameters and the collections together have 29
 * nullable fields. The tools are not `strict` (strict tools share that cap),
 * so nothing is guaranteed at the API — the sync validates every result with
 * ExtractionResultSchema before it is written.
 */
export const EXTRACTION_TOOLS = Object.entries(COLLECTIONS).map(([collection, [schema, description]]) => {
  const inputSchema = z.toJSONSchema(schema.omit({ targetCollection: true }));
  delete inputSchema.$schema;
  return { name: `record_${collection}`, description, input_schema: inputSchema };
});

/**
 * @param {{ apiKey: string, filename: string, pdfBase64: string, client?: Anthropic }} args
 * @returns {Promise<{ parsed: object, usage: { input_tokens: number, output_tokens: number } }>}
 */
export async function extractFromPdf({ apiKey, filename, pdfBase64, client }) {
  const anthropic = client ?? new Anthropic({ apiKey });

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    tools: EXTRACTION_TOOLS,
    tool_choice: { type: 'auto', disable_parallel_tool_use: true },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
          { type: 'text', text: `Filename: ${filename}\n\nExtract this document per the instructions.` },
        ],
      },
    ],
  });

  const call = response.stop_reason === 'tool_use'
    ? response.content.find((b) => b.type === 'tool_use' && b.name.startsWith('record_'))
    : null;
  if (!call) {
    throw new Error(`Claude returned no extraction for ${filename} (stop_reason: ${response.stop_reason})`);
  }

  return {
    parsed: { targetCollection: call.name.slice('record_'.length), ...call.input },
    usage: response.usage,
  };
}

/** $/1M tokens, Claude Opus 5. */
const OPUS_5_PRICE = { input: 5, output: 25 };

export function estimateCostUsd({ inputTokens, outputTokens }) {
  return (inputTokens / 1_000_000) * OPUS_5_PRICE.input
    + (outputTokens / 1_000_000) * OPUS_5_PRICE.output;
}
