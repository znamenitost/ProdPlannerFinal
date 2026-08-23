import { useCallback, useEffect, useRef, useState } from 'react';
import { DEV_CDR_PREVIEW_ENABLED, formatDevTaskFilePath } from '../utils/devCdrPreviewConfig';
import { loadTaskCdrPreview } from '../utils/devCdrPreviewService';
import { getCdrPathValidationError } from '../utils/cdrPreviewErrors';
import { cdrPreviewCacheKey } from '../utils/cdrPreviewRowHandlers';
import { setCdrPreviewBuildHooks, getActiveCdrPreviewBuildTaskIds } from '../utils/cdrAutoSearch';
import { detectClientPlatform } from '../utils/filePathForOpen';
import { useUiFeedback } from '../context/UiFeedbackContext';
import { formatUserActionError } from '../utils/actionError';

export default function useCdrPreview() {
  const { showWarning, showError } = useUiFeedback();
  const [cdrPreviewOpen, setCdrPreviewOpen] = useState(false);
  const [cdrPreviewTask, setCdrPreviewTask] = useState(null);
  const [cdrPreviewData, setCdrPreviewData] = useState(null);
  const [cdrPreviewPending, setCdrPreviewPending] = useState(false);
  const [cdrPreviewAnchor, setCdrPreviewAnchor] = useState(null);
  const cdrPreviewLoadRef = useRef(0);
  const cdrPreviewRmbListenersRef = useRef(null);
  const cdrPreviewCacheRef = useRef(new Map());
  const [cdrPreviewBuildingIds, setCdrPreviewBuildingIds] = useState(() => new Set());

  const markCdrPreviewBuilding = useCallback((taskId, building) => {
    const id = Number(taskId);
    if (!Number.isFinite(id)) return;
    setCdrPreviewBuildingIds((prev) => {
      const next = new Set(prev);
      if (building) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const isCdrPreviewBuilding = useCallback(
    (taskId) => cdrPreviewBuildingIds.has(Number(taskId)),
    [cdrPreviewBuildingIds]
  );

  useEffect(() => {
    setCdrPreviewBuildHooks({
      onStart: (taskId) => markCdrPreviewBuilding(taskId, true),
      onEnd: (taskId) => markCdrPreviewBuilding(taskId, false)
    });
    for (const taskId of getActiveCdrPreviewBuildTaskIds()) {
      markCdrPreviewBuilding(taskId, true);
    }
    return () => setCdrPreviewBuildHooks(null);
  }, [markCdrPreviewBuilding]);

  const detachCdrPreviewRmbListeners = useCallback(() => {
    const listeners = cdrPreviewRmbListenersRef.current;
    if (!listeners) return;
    if (listeners.onPointerUp) window.removeEventListener('pointerup', listeners.onPointerUp, true);
    if (listeners.onMouseUp) window.removeEventListener('mouseup', listeners.onMouseUp, true);
    if (listeners.onPointerMove) window.removeEventListener('pointermove', listeners.onPointerMove, true);
    if (listeners.onPointerDown) window.removeEventListener('pointerdown', listeners.onPointerDown, true);
    if (listeners.onKeyDown) window.removeEventListener('keydown', listeners.onKeyDown, true);
    if (listeners.onScroll) window.removeEventListener('scroll', listeners.onScroll, true);
    if (listeners.onContextMenu) window.removeEventListener('contextmenu', listeners.onContextMenu, true);
    if (listeners.openTimer) window.clearTimeout(listeners.openTimer);
    cdrPreviewRmbListenersRef.current = null;
  }, []);

  useEffect(() => () => detachCdrPreviewRmbListeners(), [detachCdrPreviewRmbListeners]);

  const attachCdrPreviewRmbListeners = useCallback((onRelease) => {
    detachCdrPreviewRmbListeners();

    let closeAllowed = false;
    const openTimer = window.setTimeout(() => {
      closeAllowed = true;
    }, 0);

    const onContextMenu = (event) => {
      event.preventDefault();
    };

    const isMacClient = detectClientPlatform() === 'mac';

    if (isMacClient) {
      const onPointerDown = (event) => {
        if (!closeAllowed) return;
        if (event.button === 0 && !event.ctrlKey) onRelease();
      };

      const onKeyDown = (event) => {
        if (event.key === 'Escape') onRelease();
      };

      const onScroll = () => {
        if (closeAllowed) onRelease();
      };

      cdrPreviewRmbListenersRef.current = {
        onPointerDown,
        onKeyDown,
        onScroll,
        onContextMenu,
        openTimer
      };
      window.addEventListener('pointerdown', onPointerDown, true);
      window.addEventListener('keydown', onKeyDown, true);
      window.addEventListener('scroll', onScroll, true);
      window.addEventListener('contextmenu', onContextMenu, true);
      return;
    }

    const shouldClose = (event) => {
      if (!closeAllowed) return false;
      if (event.pointerType && event.pointerType !== 'mouse') return false;
      return (event.buttons & 2) === 0;
    };

    const onPointerUp = (event) => {
      if (shouldClose(event)) onRelease();
    };

    const onMouseUp = (event) => {
      if (shouldClose(event)) onRelease();
    };

    const onPointerMove = (event) => {
      if (!closeAllowed) return;
      if (event.pointerType && event.pointerType !== 'mouse') return;
      if ((event.buttons & 2) === 0) onRelease();
    };

    cdrPreviewRmbListenersRef.current = {
      onPointerUp,
      onMouseUp,
      onPointerMove,
      onContextMenu,
      openTimer
    };
    window.addEventListener('pointerup', onPointerUp, true);
    window.addEventListener('mouseup', onMouseUp, true);
    window.addEventListener('pointermove', onPointerMove, true);
    window.addEventListener('contextmenu', onContextMenu, true);
  }, [detachCdrPreviewRmbListeners]);

  const loadCachedCdrPreview = useCallback(async (task) => {
    const key = cdrPreviewCacheKey(task);
    let promise = key ? cdrPreviewCacheRef.current.get(key) : null;
    if (!promise) {
      promise = loadTaskCdrPreview(task);
      if (key) {
        // LRU: при переполнении освобождаем самый старый blob URL.
        if (cdrPreviewCacheRef.current.size >= 12) {
          const oldestKey = cdrPreviewCacheRef.current.keys().next().value;
          const oldest = cdrPreviewCacheRef.current.get(oldestKey);
          cdrPreviewCacheRef.current.delete(oldestKey);
          Promise.resolve(oldest).then((result) => {
            const url = result?.preview?.url || result?.url;
            if (typeof url === 'string' && url.startsWith('blob:')) URL.revokeObjectURL(url);
          }).catch(() => {});
        }
        cdrPreviewCacheRef.current.set(key, promise);
      }
    }
    return promise;
  }, []);

  const revokeCdrPreviewCache = useCallback(() => {
    for (const promise of cdrPreviewCacheRef.current.values()) {
      Promise.resolve(promise).then((result) => {
        const url = result?.preview?.url || result?.url;
        if (typeof url === 'string' && url.startsWith('blob:')) URL.revokeObjectURL(url);
      }).catch(() => {});
    }
    cdrPreviewCacheRef.current.clear();
  }, []);

  const handleCloseCdrPreview = useCallback(() => {
    cdrPreviewLoadRef.current += 1;
    detachCdrPreviewRmbListeners();
    // Blob остаётся в кэше до unmount / LRU eviction — иначе повторное открытие
    // получит уже revoked URL.
    setCdrPreviewOpen(false);
    setCdrPreviewTask(null);
    setCdrPreviewData(null);
    setCdrPreviewPending(false);
    setCdrPreviewAnchor(null);
  }, [detachCdrPreviewRmbListeners]);

  useEffect(() => () => {
    revokeCdrPreviewCache();
  }, [revokeCdrPreviewCache]);

  const handleShowCdrPreview = useCallback(async (task, anchor) => {
    if (!DEV_CDR_PREVIEW_ENABLED) return;

    const pathError = getCdrPathValidationError(task.folderPath, task.fileName);
    if (pathError) {
      showWarning(pathError);
      return;
    }

    attachCdrPreviewRmbListeners(handleCloseCdrPreview);

    const path = formatDevTaskFilePath(task.folderPath, task.fileName);
    const loadId = ++cdrPreviewLoadRef.current;

    setCdrPreviewTask(task);
    setCdrPreviewAnchor(anchor || { x: 0, y: 0 });
    setCdrPreviewOpen(true);
    setCdrPreviewPending(true);
    setCdrPreviewData(null);

    try {
      const { preview, path: resolvedPath, error } = await loadCachedCdrPreview(task);
      if (loadId !== cdrPreviewLoadRef.current) return;

      const displayPath = resolvedPath || path;
      if (preview) {
        setCdrPreviewData({ ...preview, path: preview.path || displayPath });
      } else if (error) {
        setCdrPreviewData({ error, path: displayPath });
      } else {
        setCdrPreviewData({ path: displayPath, error: 'Превью пока нет' });
      }
    } catch (err) {
      if (loadId !== cdrPreviewLoadRef.current) return;
      const message = formatUserActionError(err, 'Не удалось загрузить превью');
      setCdrPreviewData({ path, error: message });
      showError(message);
    } finally {
      if (loadId === cdrPreviewLoadRef.current) {
        setCdrPreviewPending(false);
      }
    }
  }, [attachCdrPreviewRmbListeners, handleCloseCdrPreview, loadCachedCdrPreview, showWarning, showError]);

  return {
    handleShowCdrPreview,
    handleCloseCdrPreview,
    cdrPreviewOpen,
    cdrPreviewTask,
    cdrPreviewData,
    cdrPreviewPending,
    cdrPreviewAnchor,
    isCdrPreviewBuilding
  };
}
