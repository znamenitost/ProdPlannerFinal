/** ПКМ или Ctrl+клик (macOS) — открыть превью .cdr из БД. */
export function isCdrPreviewSecondaryClick(event) {
  if (!event) return false;
  if (event.button === 2) return true;
  return event.button === 0 && Boolean(event.ctrlKey);
}

/** Обработчики строки таблицы: превью .cdr по ПКМ (Windows — удержание, macOS — клик). */
export function getCdrPreviewRowHandlers({ task, onShowCdrPreview }) {
  if (!onShowCdrPreview) return {};

  let lastTriggerMs = 0;

  const triggerPreview = (event) => {
    const now = Date.now();
    if (now - lastTriggerMs < 400) return;
    lastTriggerMs = now;
    event.preventDefault();
    onShowCdrPreview(task, { x: event.clientX, y: event.clientY });
  };

  return {
    onContextMenu: (event) => {
      triggerPreview(event);
    },
    onPointerDownCapture: (event) => {
      if (!isCdrPreviewSecondaryClick(event)) return;
      triggerPreview(event);
    }
  };
}

export function cdrPreviewCacheKey(task) {
  if (!task?.id) return '';
  return `${task.id}|${task.folderPath || ''}|${task.fileName || ''}|${task.updatedAt || ''}|${task.hasCdrPreview ? 1 : 0}`;
}
