/** Запрос комментария перед стартом «Суеты». Возвращает текст или null при отмене. */
export async function promptFussStartComment(promptInput) {
  if (!promptInput) return null;

  const result = await promptInput({
    title: 'Суета',
    message: 'Укажите комментарий к текущему циклу работы.',
    inputLabel: 'Комментарий',
    inputRequired: true,
    confirmLabel: 'Начать',
    confirmColor: 'info'
  });

  if (result === false || result == null) return null;
  const text = String(result).trim();
  return text || null;
}
