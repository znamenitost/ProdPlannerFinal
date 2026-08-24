import { printCustomerOrderLabel } from '../services/api';
import { canPrintOrderLabel, resolvePrintLabelTaskAfterReady } from './printLabelTask';

export { canPrintOrderLabel, resolvePrintLabelTaskAfterReady };

const MAX_LABEL_COPIES = 50;

/**
 * Спросить количество наклеек.
 * @returns {Promise<number|null>} 1..50 или null при отмене / невалидном вводе
 */
export async function promptLabelQuantity(promptInput, options = {}) {
  if (!promptInput) return null;

  const result = await promptInput({
    title: options.title ?? 'Печать наклеек',
    message: options.message ?? 'Сколько наклеек напечатать?',
    inputLabel: 'Количество',
    inputType: 'number',
    inputRequired: true,
    inputMin: 1,
    inputMax: MAX_LABEL_COPIES,
    defaultValue: options.defaultValue ?? '1',
    confirmLabel: options.confirmLabel ?? 'Печать',
    cancelLabel: options.cancelLabel ?? 'Отмена',
    confirmColor: options.confirmColor ?? 'primary'
  });

  if (result === false || result == null) return null;
  const n = Number.parseInt(String(result).trim(), 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.min(n, MAX_LABEL_COPIES);
}

/** После статуса «Готово»: спросить, печатать ли наклейки, и сколько. */
export async function offerPrintLabelsAfterReady(promptInput, task, { showSuccess, showError, parentTask } = {}) {
  const printTask = resolvePrintLabelTaskAfterReady(task, parentTask);
  if (!printTask || !promptInput) return;

  const quantity = await promptLabelQuantity(promptInput, {
    title: 'Заказ готов',
    message: 'Печатать наклейки? Укажите количество.',
    confirmLabel: 'Печать',
    cancelLabel: 'Не печатать'
  });
  if (quantity == null) return;

  try {
    const job = await printCustomerOrderLabel(printTask.id, quantity);
    const code = job?.pickupCode ? ` (${job.pickupCode})` : '';
    const copies = job?.copies > 1 ? ` ×${job.copies}` : quantity > 1 ? ` ×${quantity}` : '';
    showSuccess?.(`Наклейки отправлены на печать${code}${copies}`);
  } catch (err) {
    showError?.(err.message || 'Не удалось отправить наклейки на печать');
  }
}

/** Ручная печать из меню «⋯». */
export async function printOrderLabelWithQuantityPrompt(promptInput, task, { showSuccess, showError } = {}) {
  if (!canPrintOrderLabel(task) || !promptInput) return;

  const quantity = await promptLabelQuantity(promptInput, {
    title: 'Печать наклейки',
    message: 'Сколько наклеек напечатать?',
    confirmLabel: 'Печать'
  });
  if (quantity == null) return;

  try {
    const job = await printCustomerOrderLabel(task.id, quantity);
    const code = job?.pickupCode ? ` (${job.pickupCode})` : '';
    const copies = quantity > 1 ? ` ×${quantity}` : '';
    showSuccess?.(`Наклейки отправлены на печать${code}${copies}`);
  } catch (err) {
    showError?.(err.message || 'Не удалось отправить наклейки на печать');
  }
}
