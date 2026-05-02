import { TableHead, TableRow, TableCell } from '@mui/material';

export default function TaskTableHead({ isAdmin }) {
  return (
    <TableHead>
      <TableRow sx={{ bgcolor: '#f8fafc' }}>
        <TableCell sx={{ fontWeight: 600, width: 60 }}></TableCell>
        <TableCell sx={{ fontWeight: 600 }}>Задача</TableCell>
        <TableCell sx={{ fontWeight: 600 }}>Комментарий</TableCell>
        <TableCell sx={{ fontWeight: 600, width: 230 }}>Дедлайн</TableCell>
        <TableCell sx={{ fontWeight: 600, width: 80 }}>Часы</TableCell>
        <TableCell sx={{ fontWeight: 600, width: 160 }}>Тип</TableCell>
        <TableCell sx={{ fontWeight: 600, width: 120 }}>Сотрудник</TableCell>
        <TableCell sx={{ fontWeight: 600, width: 120 }}>Статус</TableCell>
        <TableCell sx={{ fontWeight: 600, width: isAdmin ? 280 : 180 }}>Действия</TableCell>
      </TableRow>
    </TableHead>
  );
}