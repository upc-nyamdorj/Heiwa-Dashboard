import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { ExtractionResultSchema } from './pending-review-schema.mjs';

const MODEL = 'claude-opus-5';

/**
 * What Claude is asked to return. The union sits inside an object because a
 * structured-outputs schema needs `type: "object"` at the root, not a bare
 * `anyOf`. extractFromPdf unwraps it, so callers still get the union.
 */
export const ExtractionEnvelopeSchema = z.object({ document: ExtractionResultSchema });

/**
 * Replaces every `{ $ref: "#/$defs/x" }` with the definition it points at and
 * drops `$defs`. zodOutputFormat always emits refs (it asks zod for
 * `reused: 'ref'`), and the API rejects them next to `anyOf`:
 * "output_config.format.schema: For 'anyOf', '$defs' is not supported".
 * Safe because the extraction schema is not recursive.
 */
export function inlineRefs(schema) {
  const defs = schema.$defs ?? {};
  const walk = (node) => {
    if (Array.isArray(node)) return node.map(walk);
    if (!node || typeof node !== 'object') return node;
    const { $ref, ...rest } = node;
    delete rest.$defs;
    const resolved = $ref ? { ...walk(defs[$ref.replace('#/$defs/', '')]), ...rest } : rest;
    return Object.fromEntries(Object.entries(resolved).map(([k, v]) => [k, walk(v)]));
  };
  return walk(schema);
}

export function extractionOutputFormat() {
  const format = zodOutputFormat(ExtractionEnvelopeSchema);
  return { ...format, schema: inlineRefs(format.schema) };
}

const SYSTEM_PROMPT = `You are extracting structured data from one scanned, Mongolian-language \
construction-project document for the "HEIWA RESIDENCE & CARE HOME" archive. Documents are \
contracts, payment/financing reports, correspondence (letters/RFIs), quality or defect records, \
or drawing-register entries.

Classify the document into exactly one target collection: contracts, payments, correspondence, \
quality, drawings, or unclassifiable (use this only if the document doesn't fit any of the above, \
or is unreadable).

Only extract what is actually printed in the document — never guess or estimate a financial \
figure. Use null for anything not present or not legible. Dates must be ISO format (YYYY-MM-DD). \
Amounts must be the plain number with no currency symbol or thousands separators.`;

/**
 * @param {{ apiKey: string, filename: string, pdfBase64: string, client?: Anthropic }} args
 * @returns {Promise<{ parsed: object, usage: { input_tokens: number, output_tokens: number } }>}
 */
export async function extractFromPdf({ apiKey, filename, pdfBase64, client }) {
  const anthropic = client ?? new Anthropic({ apiKey });

  const response = await anthropic.messages.parse({
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
          { type: 'text', text: `Filename: ${filename}\n\nExtract this document per the instructions.` },
        ],
      },
    ],
    output_config: { format: extractionOutputFormat() },
  });

  if (!response.parsed_output) {
    throw new Error(`Claude returned no parsed output for ${filename} (stop_reason: ${response.stop_reason})`);
  }

  return { parsed: response.parsed_output.document, usage: response.usage };
}

/** $/1M tokens, Claude Opus 5. */
const OPUS_5_PRICE = { input: 5, output: 25 };

export function estimateCostUsd({ inputTokens, outputTokens }) {
  return (inputTokens / 1_000_000) * OPUS_5_PRICE.input
    + (outputTokens / 1_000_000) * OPUS_5_PRICE.output;
}
