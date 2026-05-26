import { TableHead, TableRow, TableCell } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { COL_ACTIONS } from '../utils/taskTableStyles';
import { columnCellSx } from '../utils/taskTableColumns';

export default function TaskTableHead({ columnVisibility, showHoursTypeColumns }) {
  const headCell = (columnId, label, sx = {}) => (
    <TableCell
      sx={{
        ...columnCellSx(columnId, columnVisibility, showHoursTypeColumns, {
          fontWeight: 600,
          ...sx
        })
      }}
    >
      {label}
    </TableCell>
  );

  return (
    <TableHead>
      <TableRow sx={{ bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04) }}>
        {headCell('icons', '', { width: '3%' })}
        {headCell('task', 'Задача', { width: '15%' })}
        {headCell('file', 'Файл', { width: '10%' })}
        {headCell('comment', 'Комментарий', { width: '12%' })}
        {headCell('deadline', 'Дедлайн', { width: '8%' })}
        {headCell('hours', 'Часы', { width: '6%' })}
        {headCell('type', 'Тип', { width: '8%' })}
        {headCell('employee', 'Сотрудник', { width: '8%' })}
        {headCell('status', 'Статус', { width: '8%' })}
        <TableCell
          sx={{
            ...columnCellSx('actions', columnVisibility, showHoursTypeColumns, {
              ...COL_ACTIONS,
              fontWeight: 600,
              zIndex: 3
            })
          }}
          aria-label="Действия"
        />
      </TableRow>
    </TableHead>
  );
}
