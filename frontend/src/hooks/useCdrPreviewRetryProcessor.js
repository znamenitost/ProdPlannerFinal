import { useCallback, useEffect, useRef } from 'react';
import { DEV_CDR_PREVIEW_ENABLED } from '../utils/devCdrPreviewConfig';
import { buildTaskCdrPreview } from '../utils/devCdrPreviewService';
import { fetchTaskCdrPreview } from '../utils/cdrPreviewApi';
import {
  fetchPendingCdrPreviewRetries,
  reportCdrPreviewRetryFailed
} from '../utils/cdrPreviewRetryApi';
import { getLocalAgentUnavailableMessage } from '../utils/fileOpenerAgent';
import { isCdrPreviewRetryableFailure } from '../utils/cdrPreviewErrors';

const POLL_INTERVAL_MS = 60_000;

async function tryBuildPreviewForRetryItem(item) {
  const stored = await fetchTaskCdrPreview(item.taskId);
  if (stored) return { ok: true, skipped: true };

  try {
    const preview = await buildTaskCdrPreview(item.taskId, item.folderPath, item.fileName);
    if (preview) return { ok: true, skipped: false };
    await reportCdrPreviewRetryFailed(item.taskId);
    return { ok: false, skipped: false };
  } catch (err) {
    if (isCdrPreviewRetryableFailure(err?.message)) {
      await reportCdrPreviewRetryFailed(item.taskId);
    }
    return { ok: false, skipped: false };
  }
}

export default function useCdrPreviewRetryProcessor({ enabled = false } = {}) {
  const processingRef = useRef(false);
  const activeTaskIdsRef = useRef(new Set());

  const processPending = useCallback(async () => {
    if (!enabled || !DEV_CDR_PREVIEW_ENABLED || processingRef.current) return;

    const agentUnavailable = await getLocalAgentUnavailableMessage();
    if (agentUnavailable) return;

    processingRef.current = true;
    try {
      const pending = await fetchPendingCdrPreviewRetries();
      for (const item of pending) {
        const taskId = Number(item?.taskId);
        if (!Number.isFinite(taskId) || activeTaskIdsRef.current.has(taskId)) continue;

        activeTaskIdsRef.current.add(taskId);
        try {
          await tryBuildPreviewForRetryItem(item);
        } finally {
          activeTaskIdsRef.current.delete(taskId);
        }
      }
    } catch (err) {
      console.warn('CDR preview retry processor:', err?.message || err);
    } finally {
      processingRef.current = false;
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !DEV_CDR_PREVIEW_ENABLED) return undefined;

    processPending();

    const timer = window.setInterval(processPending, POLL_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') processPending();
    };

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [enabled, processPending]);

  return { processPending };
}
