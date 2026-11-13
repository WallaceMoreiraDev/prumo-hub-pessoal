import { beforeEach, describe, expect, it, vi } from 'vitest';
import { lousasApi } from '@/features/lousas/api/lousasApi';

const mockApiClient = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('@/lib/apiClient', () => ({
  apiClient: mockApiClient,
}));

describe('lousasApi', () => {
  const LOUSA_ID = '11111111-1111-4111-8111-111111111111';

  beforeEach(() => {
    vi.clearAllMocks();
    mockApiClient.get.mockResolvedValue({});
    mockApiClient.post.mockResolvedValue({});
    mockApiClient.patch.mockResolvedValue({});
    mockApiClient.delete.mockResolvedValue({ id: LOUSA_ID });
  });

  it('usa caminhos relativos sem duplicar /api/v1 em todos os endpoints', async () => {
    const payload = {
      sceneJson: '{"type":"excalidraw","elements":[]}',
      previewBlob: new Blob(['webp'], { type: 'image/webp' }),
      previewMimeType: 'image/webp',
    };
    const controller = new AbortController();

    await lousasApi.createLousa(payload);
    await lousasApi.getLousaById(LOUSA_ID, controller.signal);
    await lousasApi.getLousaUrls(LOUSA_ID, controller.signal);
    await lousasApi.updateLousa(LOUSA_ID, payload);
    await lousasApi.deleteLousa(LOUSA_ID);

    expect(mockApiClient.post).toHaveBeenCalledWith(
      '/lousas',
      expect.any(FormData)
    );
    expect(mockApiClient.get).toHaveBeenNthCalledWith(
      1,
      `/lousas/${LOUSA_ID}`,
      { signal: controller.signal }
    );
    expect(mockApiClient.get).toHaveBeenNthCalledWith(
      2,
      `/lousas/${LOUSA_ID}/urls`,
      { signal: controller.signal }
    );
    expect(mockApiClient.patch).toHaveBeenCalledWith(
      `/lousas/${LOUSA_ID}`,
      expect.any(FormData)
    );
    expect(mockApiClient.delete).toHaveBeenCalledWith(`/lousas/${LOUSA_ID}`);

    const allCalledPaths = [
      ...mockApiClient.post.mock.calls.map((c) => c[0]),
      ...mockApiClient.get.mock.calls.map((c) => c[0]),
      ...mockApiClient.patch.mock.calls.map((c) => c[0]),
      ...mockApiClient.delete.mock.calls.map((c) => c[0]),
    ];

    for (const path of allCalledPaths) {
      expect(typeof path).toBe('string');
      expect(path).not.toContain('/api/v1');
    }
  });
});
