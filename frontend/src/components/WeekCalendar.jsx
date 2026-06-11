import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Paper,
  IconButton,
  Typography,
  Button,
  ToggleButton,
  ToggleButtonGroup
} from '@mui/material';
import { ChevronLeft, ChevronRight, CalendarMonth, Today } from '@mui/icons-material';
import { useUiFeedback } from '../context/UiFeedbackContext';
import useWeekCalendarQuery from '../hooks/queries/useWeekCalendarQuery';
import DayColumn from './DayColumn';
import { CalendarLoadingState } from './LoadingState';
import { MotionSwitch } from './ui/MotionSection';
import { buildTaskBlocksMap, isSameCalendarDay, toCalendarDayKey } from '../utils/calendarDayUtils';

export default function WeekCalendar({ employee }) {
  const { showError } = useUiFeedback();
  const [viewMode, setViewMode] = useState('week');
  const [anchorDate, setAnchorDate] = useState(() => startOfDay(new Date()));
  const [highlightedTaskId, setHighlightedTaskId] = useState(null);
  const [showWeekend, setShowWeekend] = useState(false);

  const weekStart = useMemo(
    () => getMonday(anchorDate),
    [anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate()]
  );

  const { data: weekData, isPending, isError } = useWeekCalendarQuery(employee, weekStart);

  const taskBlocksMap = useMemo(
    () => (weekData?.days ? buildTaskBlocksMap(weekData.days) : null),
    [weekData?.days]
  );

  useEffect(() => {
    if (isError) {
      showError('Не удалось загрузить календарь');
    }
  }, [isError, showError]);

  useEffect(() => {
    if (!weekData?.start) return;
    const serverMonday = startOfDay(new Date(weekData.start));
    if (serverMonday.toDateString() !== weekStart.toDateString()) {
      setAnchorDate((prev) => {
        const dayOffset = (prev.getDay() + 6) % 7;
        const aligned = new Date(serverMonday);
        aligned.setDate(serverMonday.getDate() + dayOffset);
        return aligned;
      });
    }
  }, [weekData?.start, weekStart]);

  const goPrev = () => {
    setAnchorDate((prev) => {
      if (viewMode === 'day') {
        return addWorkdays(prev, -1);
      }
      const next = new Date(prev);
      next.setDate(prev.getDate() - 7);
      return startOfDay(next);
    });
  };

  const goNext = () => {
    setAnchorDate((prev) => {
      if (viewMode === 'day') {
        return addWorkdays(prev, 1);
      }
      const next = new Date(prev);
      next.setDate(prev.getDate() + 7);
      return startOfDay(next);
    });
  };

  const handleViewModeChange = (_, newMode) => {
    if (!newMode || newMode === viewMode) return;
    if (newMode === 'day') {
      const currentDate = weekData?.currentTime ? new Date(weekData.currentTime) : new Date();
      setAnchorDate(getWorkdayOrPrevious(currentDate));
    }
    setViewMode(newMode);
  };

  if (isPending || !weekData) return <CalendarLoadingState />;

  const currentDate = weekData.currentTime ? new Date(weekData.currentTime) : new Date();
  const currentWorkday = getWorkdayOrPrevious(currentDate);
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
    ? weekData.days.filter((day) => !isWeekend(day.date) && isSameCalendarDay(day.date, anchorDate))
    : (showWeekend ? weekData.days : weekData.days.filter((_, index) => index < 5));

  const navLabel = viewMode === 'day' ? 'день' : 'неделю';
  const isAnchorToday = isSameCalendarDay(anchorDate, currentWorkday);

  return (
    <Paper variant="section" sx={{ mb: 3 }}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 1,
          mb: 4
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
          <IconButton variant="soft" color="primary" onClick={goPrev} aria-label={`Предыдущая ${navLabel}`}>
            <ChevronLeft />
          </IconButton>
          <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 1 }}>
            <CalendarMonth color="primary" />
            <Typography variant="subtitle1" sx={{ textTransform: viewMode === 'day' ? 'capitalize' : 'none' }}>
              {headerTitle}
            </Typography>
          </Box>
          <IconButton variant="soft" color="primary" onClick={goNext} aria-label={`Следующая ${navLabel}`}>
            <ChevronRight />
          </IconButton>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={handleViewModeChange}
            size="small"
            color="primary"
            aria-label="Режим календаря"
          >
            <ToggleButton value="day" aria-label="Один день">
              1 день
            </ToggleButton>
            <ToggleButton value="week" aria-label="Неделя">
              Неделя
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {viewMode === 'day' && (
          <Button
            size="small"
            variant="outlined"
            color="primary"
            startIcon={<Today />}
            onClick={() => setAnchorDate(currentWorkday)}
            disabled={isAnchorToday}
            sx={{ flexShrink: 0 }}
          >
            Сегодня
          </Button>
        )}
      </Box>

      <MotionSwitch
        transitionKey={`${viewMode}-${toCalendarDayKey(anchorDate)}-${daysToShow.length}`}
      >
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
                taskBlocksMap={taskBlocksMap}
                highlightedTaskId={highlightedTaskId}
                onTaskHover={setHighlightedTaskId}
                detailedTimeline={viewMode === 'day'}
              />
            ))}
          </Box>
        )}
      </MotionSwitch>
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

function isWeekend(date) {
  const day = new Date(date).getDay();
  return day === 0 || day === 6;
}

function addWorkdays(date, amount) {
  const next = startOfDay(date);
  const direction = amount < 0 ? -1 : 1;
  let remaining = Math.abs(amount);

  while (remaining > 0) {
    next.setDate(next.getDate() + direction);
    if (!isWeekend(next)) {
      remaining -= 1;
    }
  }

  return next;
}

function getWorkdayOrPrevious(date) {
  const next = startOfDay(date);
  while (isWeekend(next)) {
    next.setDate(next.getDate() - 1);
  }
  return next;
}
