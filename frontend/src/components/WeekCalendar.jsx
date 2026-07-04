import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Paper,
  IconButton,
  Typography,
  Button,
  ToggleButton,
  ToggleButtonGroup,
  useMediaQuery,
  useTheme
} from '@mui/material';
import { ChevronLeft, ChevronRight, CalendarMonth, Today } from '@mui/icons-material';
import { useUiFeedback } from '../context/UiFeedbackContext';
import useWeekCalendarQuery from '../hooks/queries/useWeekCalendarQuery';
import DayColumn from './DayColumn';
import DayReportList from './DayReportList';
import { CalendarLoadingState } from './LoadingState';
import { MotionSwitch } from './ui/MotionSection';
import { buildTaskBlocksMap, isSameCalendarDay, toCalendarDayKey } from '../utils/calendarDayUtils';
import useAuth from '../hooks/useAuth';
import useUserPreference from '../hooks/useUserPreference';

export default function WeekCalendar({ employee }) {
  const { showError } = useUiFeedback();
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [viewMode, setViewMode] = useUserPreference(user, 'calendar.viewMode', 'week');
  const effectiveViewMode = isMobile ? 'day' : viewMode;
  const [anchorDateKey, setAnchorDateKey] = useUserPreference(user, 'calendar.anchorDate', null);
  const anchorDate = useMemo(() => {
    if (anchorDateKey) {
      const parsed = startOfDay(new Date(anchorDateKey));
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return startOfDay(new Date());
  }, [anchorDateKey]);
  const setAnchorDate = useCallback((updater) => {
    setAnchorDateKey((prevKey) => {
      const prev = prevKey ? startOfDay(new Date(prevKey)) : startOfDay(new Date());
      const next = typeof updater === 'function' ? updater(prev) : updater;
      const day = startOfDay(next);
      if (Number.isNaN(day.getTime())) return prevKey;
      return toCalendarDayKey(day);
    });
  }, [setAnchorDateKey]);
  const [highlightedTaskId, setHighlightedTaskId] = useState(null);
  const [showWeekend] = useState(false);

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
    if (!anchorDateKey) {
      const currentDate = new Date();
      setAnchorDate(getWorkdayOrPrevious(currentDate));
    }
  }, [anchorDateKey, setAnchorDate]);

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
      if (effectiveViewMode === 'day') {
        return addWorkdays(prev, -1);
      }
      const next = new Date(prev);
      next.setDate(prev.getDate() - 7);
      return startOfDay(next);
    });
  };

  const goNext = () => {
    setAnchorDate((prev) => {
      if (effectiveViewMode === 'day') {
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
  const weekRange = `${formatCalendarNavDate(start)} - ${formatCalendarNavDate(end)}`;

  const headerTitle = effectiveViewMode === 'day'
    ? anchorDate.toLocaleDateString('ru-RU', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    })
    : weekRange;

  const daysToShow = effectiveViewMode === 'day'
    ? weekData.days.filter((day) => !isWeekend(day.date) && isSameCalendarDay(day.date, anchorDate))
    : (showWeekend ? weekData.days : weekData.days.filter((_, index) => index < 5));

  const navLabel = effectiveViewMode === 'day' ? 'день' : 'неделю';
  const isAnchorToday = isSameCalendarDay(anchorDate, currentWorkday);
  const selectedDayKey = anchorDateKey ?? toCalendarDayKey(anchorDate);

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
            <Typography variant="subtitle1" sx={{ textTransform: effectiveViewMode === 'day' ? 'capitalize' : 'none' }}>
              {headerTitle}
            </Typography>
          </Box>
          <IconButton variant="soft" color="primary" onClick={goNext} aria-label={`Следующая ${navLabel}`}>
            <ChevronRight />
          </IconButton>
          {!isMobile && (
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
          )}
        </Box>

        {effectiveViewMode === 'day' && (
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
        transitionKey={`${effectiveViewMode}-${toCalendarDayKey(anchorDate)}-${daysToShow.length}`}
      >
        {daysToShow.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
            Нет данных за выбранный день
          </Typography>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: effectiveViewMode === 'day'
                ? '1fr'
                : (showWeekend ? 'repeat(7, 1fr)' : 'repeat(5, 1fr)'),
              gap: 2,
              maxWidth: effectiveViewMode === 'day' ? 720 : 'none',
              mx: effectiveViewMode === 'day' ? 'auto' : 0
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
                detailedTimeline={effectiveViewMode === 'day'}
              />
            ))}
          </Box>
        )}
        {effectiveViewMode === 'day' && (
          <DayReportList
            key={selectedDayKey}
            employee={employee}
            dateKey={selectedDayKey}
            embedded
          />
        )}
      </MotionSwitch>
    </Paper>
  );
}

function formatCalendarNavDate(date) {
  return new Date(date).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long'
  });
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
