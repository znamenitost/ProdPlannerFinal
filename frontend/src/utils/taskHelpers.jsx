// ./frontend/src/utils/taskHelpers.js
import {
  PlayArrow,
  Pause,
  CheckCircle,
  HourglassEmpty,
  FactCheck,
  Inventory2,
  ThumbUp,
  Room
} from '@mui/icons-material';

export const truncate = (str, maxLen) => {
  if (!str) return '';
  return str.length > maxLen ? str.substring(0, maxLen) + '...' : str;
};

export const getStatusColor = (status) => {
  if (status === 'Готово' || status === 'Выдан') return 'success.main';
  if (status === 'Начал') return 'info.main';
  if (status === 'Пауза') return 'warning.main';
  if (status === 'Согласование' || status === 'На согласовании') return 'warning.main';
  return 'text.secondary';
};

export const getStatusIcon = (status, size = 16) => {
  const sx = { fontSize: size };
  switch (status) {
    case 'Начал':
    case 'В работе':
      return <PlayArrow sx={sx} />;
    case 'Пауза':
    case 'На паузе':
      return <Pause sx={sx} />;
    case 'Готово':
    case 'Выдан':
    case 'Завершена':
      return <CheckCircle sx={sx} />;
    case 'Назначена':
    case 'Суета':
      return <HourglassEmpty sx={sx} />;
    case 'Ожидание':
      return <HourglassEmpty sx={{ ...sx, opacity: 0.6 }} />;
    case 'Согласование':
    case 'На согласовании':
      return <FactCheck sx={sx} />;
    case 'Согласовано':
      return <ThumbUp sx={sx} />;
    case 'Нет изделий':
      return <Inventory2 sx={sx} />;
    case 'В наличии':
      return <Room sx={sx} />;
    default:
      return null;
  }
};

export const getParentEmployeeDisplay = (task, childrenTasks) => {
  if (childrenTasks?.length > 0) {
    const employees = new Set();
    childrenTasks.forEach((child) => {
      if (child.employeeName) employees.add(child.employeeName);
    });
    return Array.from(employees).join('/');
  }
  if (task.splitEmployeeNames) {
    return task.splitEmployeeNames;
  }
  return task.employeeName || '';
};

export const isOverdue = (deadline, status) => {
  if (status === 'Готово' || status === 'Выдан') return false;
  return new Date(deadline) < new Date();
};

export const formatTime = (dateTime) => {
  return new Date(dateTime).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
};

export const getLastPathSegment = (path) => {
  if (!path) return '';
  const parts = path.split(/[\/\\]/).filter(p => p !== '');
  return parts.length > 0 ? parts[parts.length - 1] : '';
};
