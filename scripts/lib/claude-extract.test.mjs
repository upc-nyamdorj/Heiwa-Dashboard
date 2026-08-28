import { describe, it, expect } from 'vitest';
import { extractFromPdf, estimateCostUsd } from './claude-extract.mjs';

describe('extractFromPdf', () => {
  it('sends the PDF as a native document block and returns parsed_output + usage', async () => {
    let capturedParams;
    const fakeClient = {
      messages: {
        parse: async (params) => {
          capturedParams = params;
          return {
            parsed_output: {
              targetCollection: 'contracts', party: 'Тест ХХК', contractNo: null,
              signedDate: null, start: null, end: null, value: 1000, currency: 'MNT',
              vatIncluded: null, advancePercent: null, retentionPercent: null,
              scope: null, notes: null,
            },
            usage: { input_tokens: 1234, output_tokens: 56 },
            stop_reason: 'end_turn',
          };
        },
      },
    };

    const result = await extractFromPdf({
      apiKey: 'unused', filename: 'test.pdf', pdfBase64: 'ZmFrZQ==', client: fakeClient,
    });

    expect(result.parsed.targetCollection).toBe('contracts');
    expect(result.usage.input_tokens).toBe(1234);
    expect(capturedParams.model).toBe('claude-opus-5');
    expect(capturedParams.messages[0].content[0]).toMatchObject({
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: 'ZmFrZQ==' },
    });
    expect(capturedParams.messages[0].content[1]).toMatchObject({ type: 'text' });
    expect(capturedParams.messages[0].content[1].text).toContain('test.pdf');
  });

  it('throws a clear error when Claude returns no parsed output', async () => {
    const fakeClient = {
      messages: { parse: async () => ({ parsed_output: undefined, stop_reason: 'refusal' }) },
    };
    await expect(extractFromPdf({
      apiKey: 'unused', filename: 'bad.pdf', pdfBase64: 'ZmFrZQ==', client: fakeClient,
    })).rejects.toThrow(/no parsed output/);
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
