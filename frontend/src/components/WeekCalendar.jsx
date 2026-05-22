import { useState, useEffect } from 'react';
import { Box, Paper, IconButton, Typography, Button } from '@mui/material';
import { ChevronLeft, ChevronRight, CalendarMonth, Weekend } from '@mui/icons-material';
import { glassPaperSx, softIconButtonSx } from '../theme/surfaces';
import { useUiFeedback } from '../context/UiFeedbackContext';
import { getWeekCalendar } from '../services/api';
import useClockMinute from '../hooks/useClockMinute';
import DayColumn from './DayColumn';
import { CalendarLoadingState } from './LoadingState';

export default function WeekCalendar({ employee, refresh }) {
  const { showError } = useUiFeedback();
  const clockMinute = useClockMinute(true);
  const [weekData, setWeekData] = useState(null);
  const [currentMonday, setCurrentMonday] = useState(() => getMonday(new Date()));
  const [highlightedTaskId, setHighlightedTaskId] = useState(null);
  const [showWeekend, setShowWeekend] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    const fetchData = async () => {
      try {
        const data = await getWeekCalendar(employee, currentMonday, { signal: controller.signal });
        setWeekData(data);
        if (data && data.start) {
          const serverMonday = new Date(data.start);
          if (serverMonday.toDateString() !== currentMonday.toDateString()) {
            setCurrentMonday(serverMonday);
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
  }, [employee, refresh, currentMonday, clockMinute]);

  const prevWeek = () => {
    const newMonday = new Date(currentMonday);
    newMonday.setDate(currentMonday.getDate() - 7);
    setCurrentMonday(newMonday);
  };

  const nextWeek = () => {
    const newMonday = new Date(currentMonday);
    newMonday.setDate(currentMonday.getDate() + 7);
    setCurrentMonday(newMonday);
  };

  if (!weekData) return <CalendarLoadingState />;

  const start = new Date(weekData.start);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const weekRange = `${start.toLocaleDateString('ru-RU')} - ${end.toLocaleDateString('ru-RU')}`;

  // Фильтруем дни: показываем только ПН-ПТ или все дни
  const daysToShow = showWeekend 
    ? weekData.days 
    : weekData.days.filter((_, index) => index < 5);

  return (
    <Paper sx={{ ...glassPaperSx, mb: 3 }}>
      <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', mb: 4, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 1 }}>
          <IconButton onClick={prevWeek} sx={softIconButtonSx('primary')} aria-label="Предыдущая неделя">
            <ChevronLeft />
          </IconButton>
          <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 1 }}>
            <CalendarMonth color="primary" />
            <Typography variant="subtitle1">{weekRange}</Typography>
          </Box>
          <IconButton onClick={nextWeek} sx={softIconButtonSx('primary')} aria-label="Следующая неделя">
            <ChevronRight />
          </IconButton>
        </Box>

        <Button
          size="small"
          variant={showWeekend ? 'contained' : 'outlined'}
          color="primary"
          startIcon={<Weekend />}
          onClick={() => setShowWeekend(!showWeekend)}
        >
          {showWeekend ? 'Скрыть выходные' : 'Показать выходные'}
        </Button>
      </Box>
      
      <Box sx={{ 
        display: 'grid', 
        gridTemplateColumns: showWeekend ? 'repeat(7, 1fr)' : 'repeat(5, 1fr)', 
        gap: 2 
      }}>
        {daysToShow.map(day => (
          <DayColumn 
            key={day.date} 
            day={day} 
            allDays={weekData.days} 
            highlightedTaskId={highlightedTaskId}
            onTaskHover={setHighlightedTaskId}
          />
        ))}
      </Box>
    </Paper>
  );
}

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? 6 : day - 1);
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}