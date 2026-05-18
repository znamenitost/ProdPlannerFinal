// ./frontend/src/utils/taskHelpers.js
import { PlayArrow, Pause, CheckCircle } from '@mui/icons-material';

export const truncate = (str, maxLen) => {
  if (!str) return '';
  return str.length > maxLen ? str.substring(0, maxLen) + '...' : str;
};

export const getStatusColor = (status) => {
  if (status === 'Готово') return '#22c55e';
  if (status === 'Начал') return '#3b82f6';
  if (status === 'Пауза') return '#f59e0b';
  return '#64748b';
};

export const getStatusIcon = (status) => {
  if (status === 'Готово') return <CheckCircle sx={{ fontSize: 16 }} />;
  if (status === 'Начал') return <PlayArrow sx={{ fontSize: 16 }} />;
  if (status === 'Пауза') return <Pause sx={{ fontSize: 16 }} />;
  return null;
};

export const getParentStatus = (parent) => {
  if (!parent.children || parent.children.length === 0) return "Назначена";
  const allCompleted = parent.children.every(c => c.statusText === 'Готово');
  if (allCompleted) return "Готово";
  const anyStarted = parent.children.some(c => c.statusText === 'Начал' || c.statusText === 'Пауза');
  return anyStarted ? "Начал" : "Назначена";
};

export const getUniqueEmployeesFromChildren = (children) => {
  if (!children || children.length === 0) return '';
  const employees = new Set();
  children.forEach(child => {
    if (child.employeeName) employees.add(child.employeeName);
  });
  return Array.from(employees).join('/');
};

export const getParentEmployeeDisplay = (task, childrenTasks) => {
  if (childrenTasks?.length > 0) {
    return getUniqueEmployeesFromChildren(childrenTasks);
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

// Исправленная функция: задача принадлежит пользователю, если это его задача ИЛИ он админ
export const isTaskBelongsToUser = (task, currentUser, hasChildren) => {
  if (!currentUser) return false;
  
  // Админ видит все задачи
  if (currentUser.role === 'Admin') return true;
  
  if (!hasChildren) {
    return task.employeeName === currentUser.fullName && task.statusText !== 'Готово';
  }
  
  if (hasChildren && task.children?.length) {
    return task.children.some(child => 
      child.employeeName === currentUser.fullName && 
      child.statusText !== 'Готово'
    );
  }
  return false;
};