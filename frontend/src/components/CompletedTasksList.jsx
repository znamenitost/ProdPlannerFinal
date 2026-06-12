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
  FormControl,
  Card,
  CardContent,
  Grid,
  Tooltip,
  Pagination,
  IconButton,
  Menu,
  MenuItem,
  Select,
  ListItemText,
  Checkbox
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
  Sort,
  EventNote  // добавлена для иконки периода выполнения (опционально)
} from '@mui/icons-material';
import { sectionTitleRowSx } from '../theme/surfaces';
import { useUiFeedback } from '../context/UiFeedbackContext';
import EmptyState from './ui/EmptyState';
import TaskTitleTwoLines from './TaskTitleTwoLines';
import useAuth from '../hooks/useAuth';
import useUserPreference from '../hooks/useUserPreference';

const STATS_PERIOD_OPTIONS = [
  { value: 'week', label: 'За неделю' },
  { value: 'day', label: 'За день' },
  { value: 'all', label: 'За все время' }
];

export default function CompletedTasksList({ employee }) {
  const { showError } = useUiFeedback();
  const { user } = useAuth();
  const [page, setPage] = useUserPreference(user, 'completedTasks.page', 0);
  const [rowsPerPage, setRowsPerPage] = useUserPreference(user, 'completedTasks.rowsPerPage', 25);
  const [statsPeriod, setStatsPeriod] = useUserPreference(user, 'completedTasks.statsPeriod', 'week');
  const [periodAnchorEl, setPeriodAnchorEl] = useState(null);

  const { data, isError } = useCompletedTasksQuery(employee, page, rowsPerPage, statsPeriod);

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
  const periodMenuOpen = Boolean(periodAnchorEl);
  const pageCount = Math.max(1, Math.ceil(totalCount / rowsPerPage));
  const rangeStart = totalCount === 0 ? 0 : page * rowsPerPage + 1;
  const rangeEnd = Math.min((page + 1) * rowsPerPage, totalCount);

  const handleOpenPeriodMenu = (event) => {
    setPeriodAnchorEl(event.currentTarget);
  };

  const handleClosePeriodMenu = () => {
    setPeriodAnchorEl(null);
  };

  const handleSelectStatsPeriod = (period) => {
    setStatsPeriod(period);
    setPeriodAnchorEl(null);
  };

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
    <Paper variant="section">
      <Box sx={{ ...sectionTitleRowSx, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Assessment color="primary" />
          <Typography variant="h2" component="h2">
            Выполненные задачи
          </Typography>
        </Box>
        <Tooltip title="Период статистики">
          <IconButton
            size="small"
            onClick={handleOpenPeriodMenu}
            color={statsPeriod !== 'week' ? 'primary' : 'default'}
            aria-label="Период статистики"
            sx={[
              { ml: 'auto' },
              statsPeriod !== 'week' && { border: '1px solid', borderColor: 'primary.main' }
            ]}
          >
            <Sort fontSize="small" />
          </IconButton>
        </Tooltip>
        <Menu
          anchorEl={periodAnchorEl}
          open={periodMenuOpen}
          onClose={handleClosePeriodMenu}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          {STATS_PERIOD_OPTIONS.map((option) => (
            <MenuItem key={option.value} onClick={() => handleSelectStatsPeriod(option.value)}>
              <Checkbox
                size="small"
                checked={statsPeriod === option.value}
                disableRipple
                tabIndex={-1}
                sx={{ pointerEvents: 'none' }}
              />
              <ListItemText primary={option.label} />
            </MenuItem>
          ))}
        </Menu>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card variant="statSuccess">
            <CardContent>
              <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Всего задач</Typography>
                <TaskAlt color="success" />
              </Box>
              <Typography variant="h3" sx={{ fontWeight: 700, mt: 1 }}>
                {stats.totalTasks}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card variant="statInfo">
            <CardContent>
              <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Выделено часов</Typography>
                <AccessTime color="info" />
              </Box>
              <Typography variant="h3" sx={{ fontWeight: 700, mt: 1 }}>
                {stats.totalEstimate.toFixed(1)} ч
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card variant="statWarning">
            <CardContent>
              <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Реально часов</Typography>
                <HourglassEmpty color="warning" />
              </Box>
              <Typography variant="h3" sx={{ fontWeight: 700, mt: 1 }}>
                {stats.totalActual.toFixed(1)} ч
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card variant={totalDifference >= 0 ? 'statSuccess' : 'statError'}>
            <CardContent>
              <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Экономия</Typography>
                {totalDifference >= 0 ? <TrendingUp color="success" /> : <TrendingDown color="error" />}
              </Box>
              <Typography
                variant="h3"
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
                <TableRow
                  key={task.id}
                  hover
                  sx={{
                    '& > td:first-of-type': {
                      borderLeft: '4px solid',
                      borderLeftColor: 'success.main'
                    }
                  }}
                >
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

      {totalCount > 0 && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 1.5,
            pt: 3,
            mt: 2,
            px: 1
          }}
        >
          <Typography variant="body2" color="text.secondary">
            {`${rangeStart}–${rangeEnd} из ${totalCount}`}
          </Typography>

          <Pagination
            count={pageCount}
            page={Math.min(page + 1, pageCount)}
            onChange={(_event, newPage) => setPage(newPage - 1)}
            color="primary"
            shape="rounded"
            size="medium"
            showFirstButton
            showLastButton
          />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" color="text.secondary">
              На странице
            </Typography>
            <FormControl size="small" sx={{ minWidth: 84 }}>
              <Select
                value={rowsPerPage}
                onChange={(event) => {
                  setRowsPerPage(Number(event.target.value));
                  setPage(0);
                }}
              >
                {[10, 25, 50].map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </Box>
      )}
    </Paper>
  );
}