import { useState, useEffect } from 'react';
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
  Tooltip
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
import { getCompletedTasks } from '../services/api';

export default function CompletedTasksList({ employee, refresh }) {
  const [completed, setCompleted] = useState([]);
  const [stats, setStats] = useState({ totalTasks: 0, totalEstimate: 0, totalActual: 0 });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getCompletedTasks(employee);
        setCompleted(data.tasks || []);
        setStats(data.stats || { totalTasks: 0, totalEstimate: 0, totalActual: 0 });
      } catch (err) {
        console.error('Ошибка загрузки выполненных задач:', err);
      }
    };
    fetchData();
  }, [employee, refresh]);

  const totalDifference = stats.totalEstimate - stats.totalActual;

  const getTaskDisplayName = (task) => {
    if (task.folderPath && task.folderPath.trim() !== '') {
      const segments = task.folderPath.split(/[\/\\]/).filter(s => s !== '');
      if (segments.length > 0) return segments[segments.length - 1];
    }
    return task.fileName || 'Без названия';
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
    <Paper elevation={0} sx={{ p: 3, borderRadius: 3 }}>
      <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 1, mb: 3 }}>
        <Assessment color="primary" />
        <Typography variant="h2" sx={{ fontWeight: 600 }}>
          Выполненные задачи
        </Typography>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ bgcolor: '#f0fdf4', border: '1px solid #dcfce7' }}>
            <CardContent>
              <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Всего задач</Typography>
                <TaskAlt sx={{ color: '#22c55e' }} />
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 700, mt: 1 }}>
                {stats.totalTasks}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ bgcolor: '#eff6ff', border: '1px solid #dbeafe' }}>
            <CardContent>
              <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Выделено часов</Typography>
                <AccessTime sx={{ color: '#3b82f6' }} />
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 700, mt: 1 }}>
                {stats.totalEstimate.toFixed(1)} ч
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ bgcolor: '#fef3c7', border: '1px solid #fde68a' }}>
            <CardContent>
              <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Реально часов</Typography>
                <HourglassEmpty sx={{ color: '#f59e0b' }} />
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 700, mt: 1 }}>
                {stats.totalActual.toFixed(1)} ч
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ 
            bgcolor: totalDifference >= 0 ? '#f0fdf4' : '#fef2f2', 
            border: '1px solid',
            borderColor: totalDifference >= 0 ? '#dcfce7' : '#fee2e2'
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Экономия</Typography>
                {totalDifference >= 0 ? <TrendingUp sx={{ color: '#22c55e' }} /> : <TrendingDown sx={{ color: '#ef4444' }} />}
              </Box>
              <Typography 
                variant="h4" 
                sx={{ 
                  fontWeight: 700, 
                  mt: 1, 
                  color: totalDifference >= 0 ? '#22c55e' : '#ef4444' 
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
            <TableRow sx={{ bgcolor: '#f8fafc' }}>
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
              const displayName = getTaskDisplayName(task);
              
              return (
                <TableRow key={task.id} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 1 }}>
                      {/* Иконка вместо текстового эмодзи ✅ */}
                      <CheckCircle sx={{ fontSize: 16, color: '#22c55e' }} />
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {displayName}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={task.type || 'Без типа'} 
                      size="small" 
                      sx={{ bgcolor: '#f1f5f9', fontSize: 12 }}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title={workPeriod} arrow placement="top">
                      <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 0.5, cursor: 'pointer' }}>
                        <PlayArrow sx={{ fontSize: 12, color: '#4caf50' }} />
                        <Typography variant="caption" color="text.secondary">
                          {workPeriod !== '—' ? workPeriod.substring(0, 20) + (workPeriod.length > 20 ? '...' : '') : '—'}
                        </Typography>
                        <Stop sx={{ fontSize: 12, color: '#f44336' }} />
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
                      sx={{
                        bgcolor: isPositive ? '#dcfce7' : '#fee2e2',
                        color: isPositive ? '#166534' : '#991b1b',
                        fontWeight: 500,
                        '& .MuiChip-icon': { color: isPositive ? '#22c55e' : '#ef4444' }
                      }}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {completed.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Typography variant="body1" color="text.secondary">
            Нет выполненных задач
          </Typography>
        </Box>
      )}
    </Paper>
  );
}