import { useState, useEffect, useMemo } from 'react';
import { Box, Paper, IconButton, Typography, Button } from '@mui/material';
import { ChevronLeft, ChevronRight, CalendarMonth, Weekend, ViewDay, CalendarViewWeek } from '@mui/icons-material';
import { glassPaperSx, softIconButtonSx } from '../theme/surfaces';
import { useUiFeedback } from '../context/UiFeedbackContext';
import { getWeekCalendar } from '../services/api';
import useClockMinute from '../hooks/useClockMinute';
import DayColumn from './DayColumn';
import { CalendarLoadingState } from './LoadingState';
import { isSameCalendarDay } from '../utils/calendarDayUtils';

export default function WeekCalendar({ employee, refresh }) {
  const { showError } = useUiFeedback();
  const clockMinute = useClockMinute(true);
  const [weekData, setWeekData] = useState(null);
  const [viewMode, setViewMode] = useState('week');
  const [anchorDate, setAnchorDate] = useState(() => startOfDay(new Date()));
  const [highlightedTaskId, setHighlightedTaskId] = useState(null);
  const [showWeekend, setShowWeekend] = useState(false);

  const weekStart = useMemo(
    () => getMonday(anchorDate),
    [anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate()]
  );

  useEffect(() => {
    const controller = new AbortController();

    const fetchData = async () => {
      try {
        const data = await getWeekCalendar(employee, weekStart, { signal: controller.signal });
        setWeekData(data);
        if (data?.start) {
          const serverMonday = startOfDay(new Date(data.start));
          if (serverMonday.toDateString() !== weekStart.toDateString()) {
            setAnchorDate((prev) => {
              const dayOffset = (prev.getDay() + 6) % 7;
              const aligned = new Date(serverMonday);
              aligned.setDate(serverMonday.getDate() + dayOffset);
              return aligned;
            });
          }
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Ошибка загрузки календаря:', err);
          setWeekData(null);
          showError('Не удалось загрузить календарь');
        }
      }
    };
    fetchData();
    return () => controller.abort();
  }, [employee, refresh, weekStart, clockMinute]);

  const goPrev = () => {
    setAnchorDate((prev) => {
      const next = new Date(prev);
      next.setDate(prev.getDate() - (viewMode === 'day' ? 1 : 7));
      return startOfDay(next);
    });
  };

  const goNext = () => {
    setAnchorDate((prev) => {
      const next = new Date(prev);
      next.setDate(prev.getDate() + (viewMode === 'day' ? 1 : 7));
      return startOfDay(next);
    });
  };

  const toggleViewMode = () => {
    setViewMode((mode) => {
      if (mode === 'week') {
        setAnchorDate(startOfDay(new Date()));
        return 'day';
      }
      return 'week';
    });
  };

  if (!weekData) return <CalendarLoadingState />;

  const start = new Date(weekData.start);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const weekRange = `${start.toLocaleDateString('ru-RU')} - ${end.toLocaleDateString('ru-RU')}`;

  const headerTitle = viewMode === 'day'
    ? anchorDate.toLocaleDateString('ru-RU', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
    : weekRange;

  const daysToShow = viewMode === 'day'
    ? weekData.days.filter((day) => isSameCalendarDay(day.date, anchorDate))
    : (showWeekend ? weekData.days : weekData.days.filter((_, index) => index < 5));

  const navLabel = viewMode === 'day' ? 'день' : 'неделю';

  return (
    <Paper sx={{ ...glassPaperSx, mb: 3 }}>
      <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', mb: 4, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 1 }}>
          <IconButton onClick={goPrev} sx={softIconButtonSx('primary')} aria-label={`Предыдущая ${navLabel}`}>
            <ChevronLeft />
          </IconButton>
          <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 1 }}>
            <CalendarMonth color="primary" />
            <Typography variant="subtitle1" sx={{ textTransform: viewMode === 'day' ? 'capitalize' : 'none' }}>
              {headerTitle}
            </Typography>
          </Box>
          <IconButton onClick={goNext} sx={softIconButtonSx('primary')} aria-label={`Следующая ${navLabel}`}>
            <ChevronRight />
          </IconButton>
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
          <Button
            size="small"
            variant={viewMode === 'day' ? 'contained' : 'outlined'}
            color="primary"
            startIcon={viewMode === 'week' ? <ViewDay /> : <CalendarViewWeek />}
            onClick={toggleViewMode}
          >
            {viewMode === 'week' ? '1 день' : 'Неделя'}
          </Button>
          {viewMode === 'week' && (
            <Button
              size="small"
              variant={showWeekend ? 'contained' : 'outlined'}
              color="primary"
              startIcon={<Weekend />}
              onClick={() => setShowWeekend(!showWeekend)}
            >
              {showWeekend ? 'Скрыть выходные' : 'Показать выходные'}
            </Button>
          )}
        </Box>
      </Box>

      {daysToShow.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
          Нет данных за выбранный день
        </Typography>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: viewMode === 'day'
              ? '1fr'
              : (showWeekend ? 'repeat(7, 1fr)' : 'repeat(5, 1fr)'),
            gap: 2,
            maxWidth: viewMode === 'day' ? 720 : 'none',
            mx: viewMode === 'day' ? 'auto' : 0
          }}
        >
          {daysToShow.map((day) => (
            <DayColumn
              key={day.date}
              day={day}
              allDays={weekData.days}
              highlightedTaskId={highlightedTaskId}
              onTaskHover={setHighlightedTaskId}
              detailedTimeline={viewMode === 'day'}
            />
          ))}
        </Box>
      )}
    </Paper>
  );
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getMonday(date) {
  const d = startOfDay(date);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return d;
}
