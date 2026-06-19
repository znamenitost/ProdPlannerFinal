import { useCallback, useEffect, useRef } from 'react';
import { DEV_CDR_PREVIEW_ENABLED } from '../utils/devCdrPreviewConfig';
import { fetchPendingCdrPreviewRetries } from '../utils/cdrPreviewRetryApi';
import { getLocalAgentUnavailableMessage } from '../utils/fileOpenerAgent';
import { runCdrAutoSearchSecondAttempt } from '../utils/cdrAutoSearch';

const POLL_INTERVAL_MS = 60_000;

export default function useCdrPreviewRetryProcessor({ enabled = false, showWarning } = {}) {
  const processingRef = useRef(false);
  const activeTaskIdsRef = useRef(new Set());
  const showWarningRef = useRef(showWarning);
  showWarningRef.current = showWarning;

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
          await runCdrAutoSearchSecondAttempt(item, showWarningRef.current);
        } finally {
          activeTaskIdsRef.current.delete(taskId);
        }
      }
    } catch (err) {
      console.warn('CDR autopsearch processor:', err?.message || err);
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
