import { TableHead, TableRow, TableCell } from '@mui/material';
import { alpha } from '@mui/material/styles';

export default function TaskTableHead({ isAdmin }) {
  return (
    <TableHead>
      <TableRow sx={{ bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04) }}>
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