import type { LousaDto, LousaSignedUrlsDto } from '@shared/types/lousas.types';
import { apiClient } from '@/lib/apiClient';

export interface SaveLousaPayload {
  sceneJson: string;
  previewBlob: Blob;
  previewMimeType: string;
}

function resolvePreviewFilename(mimeType: string): string {
  return mimeType === 'image/png' ? 'preview.png' : 'preview.webp';
}

function buildLousaFormData(payload: SaveLousaPayload): FormData {
  const formData = new FormData();
  const sceneFile = new Blob([payload.sceneJson], {
    type: 'application/json',
  });
  formData.append('scene', sceneFile, 'scene.excalidraw.json');
  formData.append(
    'preview',
    payload.previewBlob,
    resolvePreviewFilename(payload.previewMimeType)
  );
  return formData;
}

export const lousasApi = {
  createLousa(payload: SaveLousaPayload): Promise<LousaDto> {
    return apiClient.post<LousaDto>('/lousas', buildLousaFormData(payload));
  },

  getLousaById(id: string, signal?: AbortSignal): Promise<LousaDto> {
    return apiClient.get<LousaDto>(`/lousas/${id}`, { signal });
  },

  getLousaUrls(id: string, signal?: AbortSignal): Promise<LousaSignedUrlsDto> {
    return apiClient.get<LousaSignedUrlsDto>(`/lousas/${id}/urls`, {
      signal,
    });
  },

  updateLousa(id: string, payload: SaveLousaPayload): Promise<LousaDto> {
    return apiClient.patch<LousaDto>(
      `/lousas/${id}`,
      buildLousaFormData(payload)
    );
  },

  deleteLousa(id: string): Promise<{ id: string }> {
    return apiClient.delete<{ id: string }>(`/lousas/${id}`);
  },
};
