import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from '@mui/material';
import { PieChart } from '@mui/x-charts/PieChart';
import dayjs from 'dayjs';
import { fetchTaskTypeStats } from '../services/taskTypeStatsApi';
import { useUiFeedback } from '../context/UiFeedbackContext';
import { TASK_TABLE_TYPES } from '../hooks/taskTable/taskTableConstants';
import { tokens } from '../theme/paletteTokens';

/**
 * Явно разные пастельные из темы (не соседние оттенки одной семьи).
 * Порядок = стабильный цвет для TASK_TABLE_TYPES.
 */
const DISTINCT_THEME_COLORS = [
  tokens.primary.main,     // Резка — dust blue
  tokens.success.main,     // УФ Печать — sage
  tokens.warning.main,     // УФ ДТФ — sand
  tokens.error.main,       // Гравировка CO2 — dusty rose
  tokens.info.dark,        // Гравировка FB — deeper sky
  tokens.secondary.dark,   // Сублимация — cool grey
  tokens.workDone,         // Сборка — soft green
  tokens.noItems,          // Затирка — warm peach
  tokens.primary.dark,     // Чистка — stronger blue
  tokens.lunch,            // запас
  tokens.success.dark,
  tokens.warning.dark,
  tokens.error.dark,
  tokens.info.main,
  tokens.secondary.main
];

const TYPE_COLOR_BY_NAME = Object.fromEntries(
  TASK_TABLE_TYPES.map((type, index) => [
    type,
    DISTINCT_THEME_COLORS[index % DISTINCT_THEME_COLORS.length]
  ])
);

TYPE_COLOR_BY_NAME['Без типа'] = tokens.neutral[400];

function colorForTaskType(type) {
  const key = (type || 'Без типа').trim() || 'Без типа';
  if (TYPE_COLOR_BY_NAME[key]) return TYPE_COLOR_BY_NAME[key];

  // Неизвестный тип — стабильный индекс по строке, без соседних work-blues.
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return DISTINCT_THEME_COLORS[hash % DISTINCT_THEME_COLORS.length];
}

function formatHours(value) {
  const n = Number(value) || 0;
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export default function TaskTypeStatsDialog({ open, onClose }) {
  const { showLoading, hideSnackbar, showError } = useUiFeedback();
  const [stats, setStats] = useState(null);
  const [metric, setMetric] = useState('count');

  useEffect(() => {
    if (!open) {
      setStats(null);
      setMetric('count');
      return undefined;
    }

    const controller = new AbortController();
    let active = true;

    showLoading('Считаем статистику по типам задач…');
    fetchTaskTypeStats({ signal: controller.signal })
      .then((data) => {
        if (!active) return;
        hideSnackbar();
        setStats(data);
      })
      .catch((err) => {
        if (!active || err?.name === 'AbortError') return;
        // showError заменяет loading-snackbar; диалог оставляем — закрытие вручную
        showError(err?.message || 'Не удалось посчитать статистику');
      });

    return () => {
      active = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch once per open
  }, [open]);

  const pieData = useMemo(() => {
    const items = stats?.items || [];
    const sorted = [...items].sort((a, b) => {
      if (metric === 'hours') {
        return (b.totalActualHours || 0) - (a.totalActualHours || 0);
      }
      return (b.taskCount || 0) - (a.taskCount || 0);
    });

    return sorted
      .map((item, index) => {
        const value = metric === 'hours' ? Number(item.totalActualHours) || 0 : Number(item.taskCount) || 0;
        if (value <= 0) return null;
        const label = item.type || 'Без типа';
        return {
          id: index,
          label,
          value,
          color: colorForTaskType(label),
          taskCount: item.taskCount || 0,
          totalActualHours: item.totalActualHours || 0
        };
      })
      .filter(Boolean);
  }, [stats, metric]);

  const pieTotal = useMemo(
    () => pieData.reduce((sum, item) => sum + (Number(item.value) || 0), 0),
    [pieData]
  );

  const percentLabel = (value) => {
    const pct = pieTotal > 0 ? Math.round((Number(value) / pieTotal) * 100) : 0;
    return `${pct}%`;
  };

  const calculatedLabel = stats?.calculatedAt
    ? dayjs(stats.calculatedAt).format('DD.MM.YYYY HH:mm')
    : null;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Статистика по типам задач</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 0.5 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 1.5 }}>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={metric}
              onChange={(_e, next) => {
                if (next) setMetric(next);
              }}
            >
              <ToggleButton value="count">По количеству</ToggleButton>
              <ToggleButton value="hours">По времени</ToggleButton>
            </ToggleButtonGroup>
            {stats && (
              <Typography variant="body2" color="text.secondary">
                Завершённых листьев: {stats.totalTasks ?? 0}
                {' · '}
                {formatHours(stats.totalActualHours)} ч
                {calculatedLabel ? ` · снимок ${calculatedLabel}` : ''}
              </Typography>
            )}
          </Box>

          {!stats ? (
            <Box sx={{ minHeight: 320 }} />
          ) : pieData.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>
              Нет завершённых листовых задач для статистики
            </Typography>
          ) : (
            <PieChart
              height={360}
              series={[
                {
                  data: pieData,
                  highlightScope: { fade: 'global', highlight: 'item' },
                  faded: { additionalRadius: -8, color: tokens.neutral[300] },
                  valueFormatter: (item) => percentLabel(item.value),
                  arcLabel: (item) => percentLabel(item.value),
                  arcLabelMinAngle: 18
                }
              ]}
              slotProps={{
                legend: {
                  direction: 'vertical',
                  position: { vertical: 'middle', horizontal: 'end' }
                }
              }}
            />
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
}
