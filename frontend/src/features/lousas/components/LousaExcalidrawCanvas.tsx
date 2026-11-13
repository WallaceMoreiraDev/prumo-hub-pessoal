import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import {
  Excalidraw,
  exportToBlob,
  getNonDeletedElements,
  getSceneVersion,
  serializeAsJSON,
} from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import '@/features/lousas/components/LousaExcalidrawCanvas.css';
import type { OrderedExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type {
  AppState,
  BinaryFileData,
  BinaryFiles,
  DataURL,
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
  ExcalidrawProps,
} from '@excalidraw/excalidraw/types';
import { useTheme } from '@/components/theme/ThemeProvider';
import type { SaveLousaPayload } from '@/features/lousas/api/lousasApi';
import {
  compressRasterImageDataUrl,
  isSupportedLousaPreviewMime,
  measureUtf8ByteLength,
  type ValidatedLousaScene,
} from '@/features/lousas/utils/lousaBudget';

export interface LousaLiveStatus {
  sceneBytes: number;
  nonDeletedCount: number;
  hasUnsavedChanges: boolean;
}

export interface LousaExcalidrawCanvasHandle {
  exportPayload: () => Promise<SaveLousaPayload>;
}

export interface LousaExcalidrawCanvasProps {
  initialScene: ValidatedLousaScene | null;
  gridModeEnabled: boolean;
  onStatusChange: (status: LousaLiveStatus) => void;
}

const LOUSA_UI_OPTIONS: ExcalidrawProps['UIOptions'] = {
  canvasActions: {
    saveToActiveFile: false,
    loadScene: false,
    export: false,
    toggleTheme: false,
  },
};

const MEASUREMENT_IDLE_MS = 300;

export class EmptyLousaCanvasError extends Error {
  constructor() {
    super('Desenhe ou adicione ao menos um elemento na lousa antes de salvar.');
    this.name = 'EmptyLousaCanvasError';
  }
}

function buildSanitizedInitialData(
  initialScene: ValidatedLousaScene | null,
  theme: 'light' | 'dark'
): ExcalidrawInitialDataState {
  if (!initialScene) {
    return {
      elements: [],
      appState: {
        theme,
        gridModeEnabled: false,
      },
      scrollToContent: false,
    };
  }

  const rawAppState = initialScene.appState ?? {};
  const {
    collaborators: _collaborators,
    width: _width,
    height: _height,
    offsetTop: _offsetTop,
    offsetLeft: _offsetLeft,
    ...restAppState
  } = rawAppState;

  return {
    elements: initialScene.elements as ExcalidrawInitialDataState['elements'],
    appState: {
      ...(restAppState as ExcalidrawInitialDataState['appState']),
      theme,
    },
    files: initialScene.files as BinaryFiles | undefined,
    scrollToContent: true,
  };
}

function buildSceneSignature(
  elements: readonly OrderedExcalidrawElement[],
  files: BinaryFiles
): string {
  const version = getSceneVersion(elements);
  const fileCount = Object.keys(files).length;
  return `${elements.length}:${version}:${fileCount}`;
}

interface PendingSceneMeasurement {
  elements: readonly OrderedExcalidrawElement[];
  appState: AppState;
  files: BinaryFiles;
  nonDeletedCount: number;
  hasUnsavedChanges: boolean;
}

export const LousaExcalidrawCanvas = memo(
  forwardRef<LousaExcalidrawCanvasHandle, LousaExcalidrawCanvasProps>(
    function LousaExcalidrawCanvas(
      { initialScene, gridModeEnabled, onStatusChange },
      ref
    ) {
      const { theme } = useTheme();
      const containerRef = useRef<HTMLDivElement | null>(null);
      const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
      const initialSignatureRef = useRef<string | null>(null);
      const processedFileTokensRef = useRef<Map<string, string>>(new Map());
      const compressingFileIdsRef = useRef<Set<string>>(new Set());
      const measureTimerRef = useRef<number | null>(null);
      const isPointerDrawingRef = useRef(false);
      const pendingMeasurementRef = useRef<PendingSceneMeasurement | null>(null);
      const isMountedRef = useRef(true);

      const clearMeasurementTimer = useCallback(() => {
        if (measureTimerRef.current !== null) {
          window.clearTimeout(measureTimerRef.current);
          measureTimerRef.current = null;
        }
      }, []);

      const scheduleIdleMeasurement = useCallback(() => {
        clearMeasurementTimer();

        measureTimerRef.current = window.setTimeout(() => {
          measureTimerRef.current = null;
          if (!isMountedRef.current || isPointerDrawingRef.current) {
            return;
          }

          const pending = pendingMeasurementRef.current;
          if (!pending) {
            return;
          }
          pendingMeasurementRef.current = null;

          const serialized = serializeAsJSON(
            pending.elements,
            pending.appState,
            pending.files,
            'database'
          );
          const sceneBytes = measureUtf8ByteLength(serialized);
          onStatusChange({
            sceneBytes,
            nonDeletedCount: pending.nonDeletedCount,
            hasUnsavedChanges: pending.hasUnsavedChanges,
          });
        }, MEASUREMENT_IDLE_MS);
      }, [clearMeasurementTimer, onStatusChange]);

      useEffect(() => {
        isMountedRef.current = true;
        return () => {
          isMountedRef.current = false;
          clearMeasurementTimer();
        };
      }, [clearMeasurementTimer]);

      useEffect(() => {
        const container = containerRef.current;
        if (!container) {
          return;
        }

        const rafId = window.requestAnimationFrame(() => {
          apiRef.current?.refresh();
        });

        if (typeof ResizeObserver === 'undefined') {
          return () => window.cancelAnimationFrame(rafId);
        }

        const observer = new ResizeObserver(() => {
          apiRef.current?.refresh();
        });
        observer.observe(container);

        return () => {
          window.cancelAnimationFrame(rafId);
          observer.disconnect();
        };
      }, []);

      useEffect(() => {
        function handlePointerFinish(): void {
          if (!isPointerDrawingRef.current) {
            return;
          }
          isPointerDrawingRef.current = false;
          if (pendingMeasurementRef.current) {
            scheduleIdleMeasurement();
          }
        }

        window.addEventListener('pointerup', handlePointerFinish);
        window.addEventListener('pointercancel', handlePointerFinish);

        return () => {
          window.removeEventListener('pointerup', handlePointerFinish);
          window.removeEventListener('pointercancel', handlePointerFinish);
        };
      }, [scheduleIdleMeasurement]);

      const initialData = useMemo(
        () => buildSanitizedInitialData(initialScene, theme),
        // Mantemos initialData congelado para esta montagem do canvas, sem resetar em troca de tema.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [initialScene]
      );

      useEffect(() => {
        const api = apiRef.current;
        if (!api) {
          return;
        }

        api.updateScene({
          appState: {
            theme,
            gridModeEnabled,
          },
        });
      }, [theme, gridModeEnabled]);

      const scheduleStatusMeasurement = useCallback(
        (
          elements: readonly OrderedExcalidrawElement[],
          appState: AppState,
          files: BinaryFiles
        ) => {
          const signature = buildSceneSignature(elements, files);
          if (initialSignatureRef.current === null) {
            initialSignatureRef.current = signature;
          }

          const hasUnsavedChanges = signature !== initialSignatureRef.current;
          const nonDeletedCount = getNonDeletedElements(elements).length;

          pendingMeasurementRef.current = {
            elements,
            appState,
            files,
            nonDeletedCount,
            hasUnsavedChanges,
          };

          if (isPointerDrawingRef.current) {
            return;
          }

          scheduleIdleMeasurement();
        },
        [scheduleIdleMeasurement]
      );

  const compressPendingRasterFiles = useCallback(
    async (files: BinaryFiles) => {
      const api = apiRef.current;
      if (!api) {
        return;
      }

      const entries = Object.values(files);
      for (const file of entries) {
        const token = `${file.version ?? 0}:${file.dataURL.length}`;
        const prevToken = processedFileTokensRef.current.get(file.id);
        if (prevToken === token || compressingFileIdsRef.current.has(file.id)) {
          continue;
        }

        processedFileTokensRef.current.set(file.id, token);
        compressingFileIdsRef.current.add(file.id);

        try {
          const compressed = await compressRasterImageDataUrl(
            file.dataURL,
            file.mimeType
          );

          if (!isMountedRef.current) {
            return;
          }

          if (compressed.didCompress) {
            const nextVersion = (file.version ?? 0) + 1;
            const nextToken = `${nextVersion}:${compressed.dataUrl.length}`;
            processedFileTokensRef.current.set(file.id, nextToken);

            api.addFiles([
              {
                ...file,
                mimeType: compressed.mimeType as BinaryFileData['mimeType'],
                dataURL: compressed.dataUrl as DataURL,
                version: nextVersion,
              },
            ]);
          }
        } finally {
          compressingFileIdsRef.current.delete(file.id);
        }
      }
    },
    []
  );

  const handleCanvasChange = useCallback(
    (
      elements: readonly OrderedExcalidrawElement[],
      appState: AppState,
      files: BinaryFiles
    ) => {
      void compressPendingRasterFiles(files);
      scheduleStatusMeasurement(elements, appState, files);
    },
    [compressPendingRasterFiles, scheduleStatusMeasurement]
  );

  useImperativeHandle(
    ref,
    () => ({
      async exportPayload(): Promise<SaveLousaPayload> {
        const api = apiRef.current;
        if (!api) {
          throw new Error('A lousa ainda está sendo inicializada.');
        }

        const elements = api.getSceneElementsIncludingDeleted();
        const nonDeletedElements = getNonDeletedElements(elements);
        if (nonDeletedElements.length === 0) {
          throw new EmptyLousaCanvasError();
        }

        const appState = api.getAppState();
        const files = api.getFiles();

        const sceneJson = serializeAsJSON(
          elements,
          appState,
          files,
          'database'
        );

        let previewBlob = await exportToBlob({
          elements: nonDeletedElements,
          appState: {
            ...appState,
            exportBackground: true,
            exportWithDarkMode: theme === 'dark',
          },
          files,
          mimeType: 'image/webp',
          quality: 0.85,
          maxWidthOrHeight: 1600,
          exportPadding: 24,
        });

        if (!isSupportedLousaPreviewMime(previewBlob.type)) {
          previewBlob = await exportToBlob({
            elements: nonDeletedElements,
            appState: {
              ...appState,
              exportBackground: true,
              exportWithDarkMode: theme === 'dark',
            },
            files,
            mimeType: 'image/png',
            maxWidthOrHeight: 1600,
            exportPadding: 24,
          });
        }

        const previewMimeType = isSupportedLousaPreviewMime(previewBlob.type)
          ? previewBlob.type
          : 'image/png';

        return {
          sceneJson,
          previewBlob,
          previewMimeType,
        };
      },
    }),
    [theme]
  );

  const handleExcalidrawApi = useCallback(
    (api: ExcalidrawImperativeAPI) => {
      apiRef.current = api;
      const elements = api.getSceneElementsIncludingDeleted();
      const appState = api.getAppState();
      const files = api.getFiles();

      for (const file of Object.values(files)) {
        processedFileTokensRef.current.set(
          file.id,
          `${file.version ?? 0}:${file.dataURL.length}`
        );
      }

      initialSignatureRef.current = buildSceneSignature(elements, files);
      const serialized = serializeAsJSON(elements, appState, files, 'database');
      onStatusChange({
        sceneBytes: measureUtf8ByteLength(serialized),
        nonDeletedCount: getNonDeletedElements(elements).length,
        hasUnsavedChanges: false,
      });

      window.requestAnimationFrame(() => {
        if (isMountedRef.current) {
          api.refresh();
        }
      });
    },
    [onStatusChange]
  );

  const handlePointerDownCapture = useCallback(() => {
    isPointerDrawingRef.current = true;
    clearMeasurementTimer();
  }, [clearMeasurementTimer]);

  return (
    <div
      ref={containerRef}
      onPointerDownCapture={handlePointerDownCapture}
      className="h-full w-full touch-none select-none"
      style={{ touchAction: 'none' }}
    >
      <Excalidraw
        excalidrawAPI={handleExcalidrawApi}
        initialData={initialData}
        onChange={handleCanvasChange}
        theme={theme}
        langCode="pt-BR"
        gridModeEnabled={gridModeEnabled}
        UIOptions={LOUSA_UI_OPTIONS}
      />
    </div>
  );
    }
  )
);
