// Генерация времени с шагом 30 минут
export const generateTimeOptions = () => {
  const times = [];
  for (let h = 0; h < 24; h++) {
    for (let m of [0, 30]) {
      const hour = h.toString().padStart(2, '0');
      const minute = m.toString().padStart(2, '0');
      times.push(`${hour}:${minute}`);
    }
  }
  return times;
};

export const TIME_OPTIONS = generateTimeOptions();
export const DEFAULT_TIME = '15:00';  // ← ДОБАВИТЬ, если нет

// Парсинг даты и времени
export const parseDateTime = (dateTimeStr) => {
  if (!dateTimeStr) return { date: '', time: DEFAULT_TIME };
  const date = new Date(dateTimeStr);
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return { date: `${year}-${month}-${day}`, time: `${hours}:${minutes}` };
};

// Объединение даты и времени
export const combineDateTime = (date, time) => {
  if (!date) return '';
  return `${date}T${time}`;
};

// Сокращение пути
export const getShortName = (fullPath, isChild = false) => {
  if (!fullPath) return '';
  const parts = fullPath.split(/[\/\\]/).filter(p => p !== '');
  if (parts.length === 0) return '';
  if (isChild) {
    return parts[parts.length - 1];
  }
  const lastLevels = parts.slice(-2);
  let result = lastLevels.join('/');
  if (result.length > 40) {
    return '...' + result.substring(result.length - 37);
  }
  return result;
};

// Цвет статуса
export { getStatusChipColor as getStatusColor } from '../theme/statusColors';

// Иконка статуса
export const getStatusIcon = (status) => {
  if (status === 'Готово' || status === 'Выдан') return 'CheckCircle';
  if (status === 'Начал') return 'PlayArrow';
  if (status === 'Пауза') return 'Pause';
  return null;
};

// Иконка типа
export const getTypeIcon = (type) => {
  if (type?.includes('Резка')) return 'Build';
  if (type?.includes('УФ')) return 'Print';
  return null;
};

// Просрочена ли задача
export const isOverdue = (deadline, status) => {
  if (status === 'Готово' || status === 'Выдан') return false;
  return new Date(deadline) < new Date();
};

// Прогресс родительской задачи
export const getParentProgress = (parent) => {
  if (!parent.children || parent.children.length === 0) return 0;
  const completed = parent.children.filter(
    (c) => c.statusText === 'Готово' || c.statusText === 'Выдан'
  ).length;
  return (completed / parent.children.length) * 100;
};

// Группировка задач по родителям
export const groupTasksByParent = (tasks) => {
  const parents = tasks.filter(t => !t.parentRowNumber || t.parentRowNumber === 0 || t.parentRowNumber === null);
  const children = tasks.filter(t => t.parentRowNumber && t.parentRowNumber > 0);
  return parents.map(parent => ({
    ...parent,
    children: children.filter(c => c.parentRowNumber === parent.id)
  }));
};

// Уникальные сотрудники для дочерних задач
export const getUniqueEmployees = (children) => {
  const uniqueEmployees = new Set();
  children.forEach(child => {
    if (child.employeeName) {
      uniqueEmployees.add(child.employeeName);
    }
  });
  return Array.from(uniqueEmployees);
};