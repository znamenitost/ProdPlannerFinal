import { TableHead, TableRow, TableCell } from '@mui/material';

export default function TaskTableHead({ isAdmin }) {
  return (
    <TableHead>
      <TableRow sx={{ bgcolor: '#f8fafc' }}>
        <TableCell sx={{ fontWeight: 600, width: '3%' }}></TableCell>
        <TableCell sx={{ fontWeight: 600, width: '15%' }}>Задача</TableCell>
        <TableCell sx={{ fontWeight: 600, width: '10%' }}>Файл</TableCell>
        <TableCell sx={{ fontWeight: 600, width: '20%' }}>Комментарий</TableCell>
        <TableCell sx={{ fontWeight: 600, width: '10%' }}>Дедлайн</TableCell>
        <TableCell sx={{ fontWeight: 600, width: '6%' }}>Часы</TableCell>
        <TableCell sx={{ fontWeight: 600, width: '8%' }}>Тип</TableCell>
        <TableCell sx={{ fontWeight: 600, width: '8%' }}>Сотрудник</TableCell>
        <TableCell sx={{ fontWeight: 600, width: '8%' }}>Статус</TableCell>
        <TableCell sx={{ fontWeight: 600, width: isAdmin ? '12%' : '10%' }}>Действия</TableCell>
      </TableRow>
    </TableHead>
  );
}