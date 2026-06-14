/** Обработчики строки таблицы: превью .cdr по удержанию ПКМ. */
export function getCdrPreviewRowHandlers({ task, onShowCdrPreview }) {
  if (!onShowCdrPreview) return {};

  return {
    onContextMenu: (event) => {
      event.preventDefault();
    },
    onPointerDownCapture: (event) => {
      if (event.button !== 2) return;
      event.preventDefault();
      onShowCdrPreview(task, { x: event.clientX, y: event.clientY });
    }
  };
}

export function cdrPreviewCacheKey(task) {
  if (!task?.id) return '';
  return `${task.id}|${task.folderPath || ''}|${task.fileName || ''}|${task.updatedAt || ''}|${task.hasCdrPreview ? 1 : 0}`;
}
