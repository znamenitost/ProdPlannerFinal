/** Подсказки по медиа для админ-конструктора каталога. */
export const MEDIA_HINTS = {
  photo: {
    title: 'Главное фото (hero)',
    formats: 'WebP или JPEG (лучше WebP)',
    size: 'идеально 150–400 КБ, максимум 2 МБ',
    dimensions: 'квадрат 1200×1200 или 1600×1600 px',
    tip: 'Светлый фон, без текста на картинке. Тяжёлые PNG лучше конвертировать в WebP.'
  },
  colorPreview: {
    title: 'Превью цвета (брелок/изделие)',
    formats: 'SVG (предпочтительно) или WebP/PNG',
    size: 'SVG до 200 КБ; растр 80–250 КБ',
    dimensions: 'изолированный объект на прозрачном фоне',
    tip: 'Один файл = один цвет. Hex квадратика должен совпадать с заливкой объекта.'
  },
  mockupBase: {
    title: 'База примерки',
    formats: 'SVG или WebP',
    size: 'до 300 КБ',
    dimensions: 'тот же кадр, что и цветные превью',
    tip: 'Можно не задавать — тогда берётся превью выбранного цвета.'
  },
  mockupMask: {
    title: 'Маска зоны нанесения',
    formats: 'PNG или SVG с альфой',
    size: 'до 200 КБ',
    dimensions: '1:1 с базой, белая/светлая зона = область лого',
    tip: 'Чёрный = скрыто, белый = видимая область макета.'
  },
  template: {
    title: 'Шаблон для клиента (.CDR)',
    formats: 'CDR, PDF, SVG или ZIP',
    size: 'до 15 МБ (лучше сжать до 5 МБ)',
    dimensions: 'реальные размеры изделия в мм',
    tip: 'Имя файла понятное клиенту, например budapest-template.cdr.'
  }
};

export function hintText(key) {
  const h = MEDIA_HINTS[key];
  if (!h) return '';
  return `${h.title}: ${h.formats}; ${h.size}; ${h.dimensions}. ${h.tip}`;
}
