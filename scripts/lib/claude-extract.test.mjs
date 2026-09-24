import { describe, it, expect } from 'vitest';
import { extractFromPdf, estimateCostUsd, EXTRACTION_TOOLS } from './claude-extract.mjs';
import { ExtractionResultSchema } from './pending-review-schema.mjs';

const CONTRACT_INPUT = {
  party: 'Тест ХХК', contractNo: null, signedDate: null, start: null, end: null, value: 1000,
  currency: 'MNT', vatIncluded: null, advancePercent: null, retentionPercent: null,
  scope: null, notes: null,
};

function clientReturning(response, onCreate = () => {}) {
  return { messages: { create: async (params) => { onCreate(params); return response; } } };
}

describe('extractFromPdf', () => {
  it('sends the PDF as a native document block and maps the tool call to a record', async () => {
    let captured;
    const client = clientReturning({
      stop_reason: 'tool_use',
      content: [
        { type: 'thinking', thinking: '' },
        { type: 'tool_use', id: 't1', name: 'record_contracts', input: CONTRACT_INPUT },
      ],
      usage: { input_tokens: 1234, output_tokens: 56 },
    }, (p) => { captured = p; });

    const result = await extractFromPdf({ apiKey: 'unused', filename: 'test.pdf', pdfBase64: 'ZmFrZQ==', client });

    expect(result.parsed).toEqual({ targetCollection: 'contracts', ...CONTRACT_INPUT });
    expect(ExtractionResultSchema.safeParse(result.parsed).success).toBe(true);
    expect(result.usage.input_tokens).toBe(1234);
    expect(captured.model).toBe('claude-opus-5');
    expect(captured.tools).toBe(EXTRACTION_TOOLS);
    expect(captured.tool_choice).toEqual({ type: 'auto', disable_parallel_tool_use: true });
    expect(captured.messages[0].content[0]).toMatchObject({
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: 'ZmFrZQ==' },
    });
    expect(captured.messages[0].content[1].text).toContain('test.pdf');
  });

  it('throws a clear error when Claude does not call an extraction tool', async () => {
    const client = clientReturning({ stop_reason: 'refusal', content: [], usage: {} });
    await expect(extractFromPdf({ apiKey: 'x', filename: 'a.pdf', pdfBase64: 'eA==', client }))
      .rejects.toThrow(/no extraction for a\.pdf.*refusal/);
  });
});

describe('extraction tools', () => {
  it('offers one tool per target collection', () => {
    expect(EXTRACTION_TOOLS.map((t) => t.name)).toEqual([
      'record_contracts', 'record_payments', 'record_correspondence',
      'record_quality', 'record_drawings', 'record_unclassifiable',
    ]);
  });

  it('gives each tool a plain object schema without the collection tag', () => {
    for (const tool of EXTRACTION_TOOLS) {
      expect(tool.input_schema.type).toBe('object');
      expect(tool.input_schema.properties.targetCollection).toBeUndefined();
      expect(tool.input_schema.$schema).toBeUndefined();
      expect(JSON.stringify(tool.input_schema)).not.toContain('$ref');
    }
    const contracts = EXTRACTION_TOOLS[0].input_schema;
    expect(contracts.properties.signedDate.description).toMatch(/ISO date/);
    expect(contracts.required).toContain('party');
  });
});

describe('estimateCostUsd', () => {
  it('applies Claude Opus 5 pricing ($5/$25 per 1M input/output tokens)', () => {
    const cost = estimateCostUsd({ inputTokens: 1_000_000, outputTokens: 1_000_000 });
    expect(cost).toBeCloseTo(30, 5);
  });

  it('is zero for zero usage', () => {
    expect(estimateCostUsd({ inputTokens: 0, outputTokens: 0 })).toBe(0);
  });
});
