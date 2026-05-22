// ./frontend/src/utils/taskHelpers.js
import { PlayArrow, Pause, CheckCircle, HourglassEmpty } from '@mui/icons-material';

export const truncate = (str, maxLen) => {
  if (!str) return '';
  return str.length > maxLen ? str.substring(0, maxLen) + '...' : str;
};

export const getStatusColor = (status) => {
  if (status === 'Готово') return 'success.main';
  if (status === 'Начал') return 'info.main';
  if (status === 'Пауза') return 'warning.main';
  return 'text.secondary';
};

export const getStatusIcon = (status) => {
  if (status === 'Готово') return <CheckCircle sx={{ fontSize: 16 }} />;
  if (status === 'Начал') return <PlayArrow sx={{ fontSize: 16 }} />;
  if (status === 'Пауза') return <Pause sx={{ fontSize: 16 }} />;
  if (status === 'Назначена') return <HourglassEmpty sx={{ fontSize: 16 }} />;
  return null;
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
  if (status === 'Готово') return false;
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
