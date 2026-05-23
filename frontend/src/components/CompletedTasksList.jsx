import { useState, useEffect } from 'react';
import useCompletedTasksQuery from '../hooks/queries/useCompletedTasksQuery';
import { 
  Paper, 
  Typography, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow,
  Chip,
  Box,
  Card,
  CardContent,
  Grid,
  Tooltip,
  TablePagination
} from '@mui/material';
import { 
  CheckCircle, 
  AccessTime, 
  TrendingUp, 
  TrendingDown,
  Assessment,
  TaskAlt,
  HourglassEmpty,
  PlayArrow,
  Stop,
  EventNote  // добавлена для иконки периода выполнения (опционально)
} from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import { glassPaperSx, sectionTitleRowSx } from '../theme/surfaces';
import { useUiFeedback } from '../context/UiFeedbackContext';
import EmptyState from './ui/EmptyState';
import TaskTitleTwoLines from './TaskTitleTwoLines';

export default function CompletedTasksList({ employee }) {
  const { showError } = useUiFeedback();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const { data, isError } = useCompletedTasksQuery(employee, page, rowsPerPage);

  useEffect(() => {
    if (isError) {
      showError('Не удалось загрузить выполненные задачи');
    }
  }, [isError, showError]);

  useEffect(() => {
    setPage(0);
  }, [employee]);

  const completed = data?.tasks ?? [];
  const stats = data?.stats ?? { totalTasks: 0, totalEstimate: 0, totalActual: 0 };
  const totalCount = data?.totalCount ?? stats.totalTasks ?? 0;

  const totalDifference = stats.totalEstimate - stats.totalActual;

  const formatWorkPeriod = (intervals) => {
    if (!intervals || intervals.length === 0) return '—';
    
    const formatTime = (date) => date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    const formatDate = (date) => date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
    
    const periods = intervals.map(interval => {
      const start = new Date(interval.startTime);
      const end = interval.endTime ? new Date(interval.endTime) : null;
      if (!end) return `${formatTime(start)} - ...`;
      
      const startDateStr = formatDate(start);
      const endDateStr = formatDate(end);
      
      if (startDateStr !== endDateStr) {
        return `${startDateStr} ${formatTime(start)} - ${endDateStr} ${formatTime(end)}`;
      }
      return `${formatTime(start)} - ${formatTime(end)}`;
    });
    
    return periods.join(', ');
  };

  return (
    <Paper sx={glassPaperSx}>
      <Box sx={{ ...sectionTitleRowSx, mb: 3 }}>
        <Assessment color="primary" />
        <Typography variant="h2" component="h2">
          Выполненные задачи
        </Typography>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ bgcolor: (t) => alpha(t.palette.success.main, 0.08), border: (t) => `1px solid ${alpha(t.palette.success.main, 0.2)}` }}>
            <CardContent>
              <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Всего задач</Typography>
                <TaskAlt color="success" />
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 700, mt: 1 }}>
                {stats.totalTasks}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ bgcolor: (t) => alpha(t.palette.info.main, 0.08), border: (t) => `1px solid ${alpha(t.palette.info.main, 0.2)}` }}>
            <CardContent>
              <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Выделено часов</Typography>
                <AccessTime color="info" />
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 700, mt: 1 }}>
                {stats.totalEstimate.toFixed(1)} ч
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ bgcolor: (t) => alpha(t.palette.warning.main, 0.1), border: (t) => `1px solid ${alpha(t.palette.warning.main, 0.25)}` }}>
            <CardContent>
              <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Реально часов</Typography>
                <HourglassEmpty color="warning" />
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 700, mt: 1 }}>
                {stats.totalActual.toFixed(1)} ч
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={(t) => ({
            bgcolor: alpha(totalDifference >= 0 ? t.palette.success.main : t.palette.error.main, 0.08),
            border: `1px solid ${alpha(totalDifference >= 0 ? t.palette.success.main : t.palette.error.main, 0.22)}`
          })}>
            <CardContent>
              <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Экономия</Typography>
                {totalDifference >= 0 ? <TrendingUp color="success" /> : <TrendingDown color="error" />}
              </Box>
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 700,
                  mt: 1,
                  color: totalDifference >= 0 ? 'success.main' : 'error.main'
                }}
              >
                {totalDifference >= 0 ? '+' : ''}{totalDifference.toFixed(1)} ч
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <TableContainer>
        <Table sx={{ minWidth: 800 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>Задача</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Тип</TableCell>
              <TableCell align="center" sx={{ fontWeight: 600 }}>Период выполнения</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>Выделено</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>Реально</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>Разница</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {completed.map((task) => {
              const diff = task.estimateHours - task.actualHours;
              const isPositive = diff >= 0;
              const workPeriod = formatWorkPeriod(task.workIntervals);
              return (
                <TableRow key={task.id} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 1, minWidth: 0 }}>
                      <CheckCircle sx={{ fontSize: 16, flexShrink: 0 }} color="success" />
                      <TaskTitleTwoLines
                        task={task}
                        headingVariant="body2"
                        statusVariant="caption"
                        headingSx={{ fontWeight: 500 }}
                        sx={{ flex: 1, minWidth: 0 }}
                      />
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={task.type || 'Без типа'} 
                      size="small" 
                      variant="outlined" sx={{ fontSize: 12 }}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title={workPeriod} arrow placement="top">
                      <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 0.5, cursor: 'pointer' }}>
                        <PlayArrow sx={{ fontSize: 12, color: 'success.main' }} />
                        <Typography variant="caption" color="text.secondary">
                          {workPeriod !== '—' ? workPeriod.substring(0, 20) + (workPeriod.length > 20 ? '...' : '') : '—'}
                        </Typography>
                        <Stop sx={{ fontSize: 12, color: 'error.main' }} />
                      </Box>
                    </Tooltip>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {task.estimateHours.toFixed(1)} ч
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" color="text.secondary">
                      {task.actualHours.toFixed(1)} ч
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Chip
                      size="small"
                      icon={isPositive ? <TrendingUp /> : <TrendingDown />}
                      label={`${isPositive ? '+' : ''}${diff.toFixed(1)} ч`}
                      color={isPositive ? 'success' : 'error'}
                      variant="outlined"
                      sx={{ fontWeight: 500 }}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {completed.length === 0 && <EmptyState message="Нет выполненных задач" icon={TaskAlt} />}

      <TablePagination
        component="div"
        count={totalCount}
        page={page}
        onPageChange={(_e, newPage) => setPage(newPage)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(e) => {
          setRowsPerPage(parseInt(e.target.value, 10));
          setPage(0);
        }}
        rowsPerPageOptions={[10, 25, 50]}
        labelRowsPerPage="Строк на странице"
      />
    </Paper>
  );
}