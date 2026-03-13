import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cosineSimilarity } from './embeddings';

// We test cosineSimilarity directly since it's pure math.
// embedText/embedBatch require a running Ollama instance, so we test their
// interface via mocking in context-store tests.

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    const v = [1, 2, 3, 4, 5];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1, 5);
  });

  it('returns 0 for orthogonal vectors', () => {
    const a = [1, 0, 0];
    const b = [0, 1, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(0, 5);
  });

  it('returns -1 for opposite vectors', () => {
    const a = [1, 0];
    const b = [-1, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1, 5);
  });

  it('handles zero vectors gracefully', () => {
    const zero = [0, 0, 0];
    const v = [1, 2, 3];
    expect(cosineSimilarity(zero, v)).toBe(0);
  });

  it('computes correct similarity for known vectors', () => {
    const a = [1, 2, 3];
    const b = [4, 5, 6];
    // dot = 4+10+18 = 32, |a| = sqrt(14), |b| = sqrt(77)
    const expected = 32 / (Math.sqrt(14) * Math.sqrt(77));
    expect(cosineSimilarity(a, b)).toBeCloseTo(expected, 5);
  });
});

describe('embedText and embedBatch', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('embedText calls Ollama API correctly', async () => {
    const mockEmbedding = Array(768).fill(0).map((_, i) => Math.sin(i));

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ embedding: mockEmbedding }),
    });

    const { embedText } = await import('./embeddings');
    const result = await embedText('test text');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/embeddings'),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('nomic-embed-text'),
      }),
    );
    expect(result).toHaveLength(768);
  });

  it('embedText throws on API error', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'model not found',
    });

    const { embedText } = await import('./embeddings');
    await expect(embedText('fail')).rejects.toThrow('Embedding failed');
  });

  it('embedBatch processes multiple texts', async () => {
    const mockEmbedding = Array(768).fill(0.1);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ embedding: mockEmbedding }),
    });

    const { embedBatch } = await import('./embeddings');
    const results = await embedBatch(['text 1', 'text 2', 'text 3']);

    expect(results).toHaveLength(3);
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });
});
