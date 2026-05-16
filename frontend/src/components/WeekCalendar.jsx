import { useState, useEffect } from 'react';
import { Box, Paper, IconButton, Typography, Button, alpha } from '@mui/material';
import { ChevronLeft, ChevronRight, CalendarMonth, Weekend } from '@mui/icons-material';
import { getWeekCalendar } from '../services/api';
import DayColumn from './DayColumn';

export default function WeekCalendar({ employee, refresh }) {
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
        }
      }
    };
    fetchData();
    return () => controller.abort();
  }, [employee, refresh, currentMonday]);

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

  if (!weekData) return <Box sx={{ textAlign: 'center', py: 4 }}>Загрузка календаря...</Box>;

  const start = new Date(weekData.start);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const weekRange = `${start.toLocaleDateString('ru-RU')} - ${end.toLocaleDateString('ru-RU')}`;

  // Фильтруем дни: показываем только ПН-ПТ или все дни
  const daysToShow = showWeekend 
    ? weekData.days 
    : weekData.days.filter((_, index) => index < 5);

  return (
    <Paper elevation={0} sx={{ p: 3, mb: 3, background: 'rgba(255,255,255,0.9)' }}>
      <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', mb: 6 }}>
        <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 1 }}>
          <IconButton 
            onClick={prevWeek} 
            sx={{ bgcolor: alpha('#6366f1', 0.1), '&:hover': { bgcolor: alpha('#6366f1', 0.2) } }}
          >
            <ChevronLeft />
          </IconButton>
          <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 1 }}>
            <CalendarMonth sx={{ color: '#6366f1' }} />
            <Typography variant="body1" sx={{ fontWeight: 600 }}>{weekRange}</Typography>
          </Box>
          <IconButton 
            onClick={nextWeek}
            sx={{ bgcolor: alpha('#6366f1', 0.1), '&:hover': { bgcolor: alpha('#6366f1', 0.2) } }}
          >
            <ChevronRight />
          </IconButton>
        </Box>
        
        <Button
          size="small"
          variant={showWeekend ? 'contained' : 'outlined'}
          startIcon={<Weekend />}
          onClick={() => setShowWeekend(!showWeekend)}
          sx={{ 
            borderRadius: 2,
            textTransform: 'none',
            fontSize: '0.75rem',
            ...(showWeekend ? {
              bgcolor: '#6366f1',
              '&:hover': { bgcolor: '#4f46e5' }
            } : {
              borderColor: '#cbd5e1',
              color: '#64748b'
            })
          }}
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