import { useState } from 'react';
import { Paper, Typography, Box, Tooltip } from '@mui/material';
import { CheckCircle, Warning, Restaurant, PlayArrow, Schedule, Pause, Assignment, DoneAll } from '@mui/icons-material';

const tooltipSx = {
  bgcolor: '#1e293b',
  fontSize: '12px',
  padding: '8px 15px',
  minWidth: '350px',
  maxWidth: 'none',
  width: 'max-content',
  borderRadius: 2,
  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
};

export default function DayColumn({ day, allDays, highlightedTaskId, onTaskHover }) {
  const date = new Date(day.date);
  const netSaved = day.netSaved;
  const savedText = netSaved >= 0 ? `🌱 +${netSaved.toFixed(1)} ч` : `🔴 ${netSaved.toFixed(1)} ч`;

  const isWorkingDay = date.getDay() >= 1 && date.getDay() <= 5;

  const getWorkColor = (taskId, completed) => {
    if (completed) return '#86b386';
    const colors = ['#7c9ebf', '#9bb5d4', '#a8c4e0', '#b8d0e8', '#8aadc9', '#6b8fae'];
    return colors[taskId % colors.length];
  };

  const formatTime = (dateTime) => new Date(dateTime).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

  const getTimelineSegments = () => {
    if (!day.timeline || day.timeline.length === 0) return [];
    
    const segments = [];
    const lunchStart = new Date(date);
    lunchStart.setHours(14, 0, 0, 0);
    const lunchEnd = new Date(date);
    lunchEnd.setHours(15, 0, 0, 0);
    
    day.timeline.forEach(segment => {
      const start = new Date(segment.start);
      const end = new Date(segment.end);
      
      if (segment.type === 'work') {
        if (start < lunchEnd && end > lunchStart) {
          if (start < lunchStart) {
            const beforeLunchEnd = end < lunchStart ? end : lunchStart;
            if (beforeLunchEnd > start) {
              segments.push({ ...segment, start: start, end: beforeLunchEnd });
            }
          }
          if (end > lunchEnd) {
            const afterLunchStart = start > lunchEnd ? start : lunchEnd;
            if (end > afterLunchStart) {
              segments.push({ ...segment, start: afterLunchStart, end: end });
            }
          }
        } else {
          segments.push({ ...segment, start: start, end: end });
        }
      } else {
        const isLunchTime = (start >= lunchStart && start < lunchEnd) ||
                            (end > lunchStart && end <= lunchEnd) ||
                            (start <= lunchStart && end >= lunchEnd);
        if (!isLunchTime) {
          segments.push({ ...segment, start: start, end: end });
        }
      }
    });
    
    return segments.sort((a, b) => new Date(a.start) - new Date(b.start));
  };

  const rawTimelineSegments = getTimelineSegments();
  const workSegments = rawTimelineSegments.filter(s => s.type === 'work');

  const taskBlocksMap = new Map();
  allDays?.forEach(d => {
    d.taskBlocks?.forEach(block => {
      if (block.taskId) {
        if (!taskBlocksMap.has(block.taskId)) taskBlocksMap.set(block.taskId, []);
        taskBlocksMap.get(block.taskId).push({ ...block, dayDate: d.date });
      }
    });
  });

  const getTaskInfoForDeadline = (deadlineTaskId, deadlineTaskTitle, deadlineStatus) => {
    if (deadlineStatus === 'Completed') {
      return { title: deadlineTaskTitle, totalHours: 0, blocksCount: 0, blocks: [], hasBlocks: false, isCompleted: true };
    }
    const blocks = taskBlocksMap.get(deadlineTaskId);
    if (blocks && blocks.length > 0) {
      const firstBlock = blocks[0];
      let totalHours = 0;
      blocks.forEach(b => { totalHours += b.hours; });
      return {
        title: firstBlock.fullTitle || firstBlock.title,
        totalHours,
        blocksCount: blocks.length,
        blocks,
        hasBlocks: true,
        isCompleted: false
      };
    }
    if (deadlineTaskTitle) {
      return { title: deadlineTaskTitle, totalHours: 0, blocksCount: 0, blocks: [], hasBlocks: false, isCompleted: false };
    }
    return null;
  };

  const isHighlighted = (block) => highlightedTaskId === block.taskId;

  return (
    <Paper elevation={0} sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.95)', borderRadius: 3 }}>
      <Typography variant="subtitle1" fontWeight={600} sx={{ textAlign: 'center', mb: 2, color: '#1e293b' }}>
        {date.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric' })}
      </Typography>

      {/* Плановая загрузка */}
      <Box sx={{ position: 'relative', bgcolor: '#f1f5f9', height: 32, borderRadius: 2, mb: 3, overflow: 'hidden', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)' }}>
        {day.taskBlocks?.map((block, idx) => {
          const isFirst = idx === 0;
          const isLast = idx === day.taskBlocks.length - 1;
          return (
            <Tooltip key={idx} title={`${block.fullTitle || block.title}: ${block.hours.toFixed(1)} ч`} arrow placement="top" slotProps={{ tooltip: { sx: tooltipSx } }}>
              <Box
                sx={{
                  position: 'absolute',
                  left: `${block.leftPercent}%`,
                  width: `${block.widthPercent}%`,
                  height: '100%',
                  top: 0,
                  backgroundColor: isHighlighted(block) ? '#f59e0b' : '#7c9ebf',
                  opacity: isHighlighted(block) ? 0.95 : 0.85,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  borderRight: idx !== day.taskBlocks?.length - 1 ? '1px solid rgba(255,255,255,0.3)' : 'none',
                  borderTopLeftRadius: isFirst ? 2 : 0,
                  borderBottomLeftRadius: isFirst ? 2 : 0,
                  borderTopRightRadius: isLast ? 2 : 0,
                  borderBottomRightRadius: isLast ? 2 : 0,
                  boxShadow: isHighlighted(block) ? '0 0 8px rgba(245,158,11,0.5)' : 'none',
                  '&:hover': { opacity: 1, filter: 'brightness(0.95)' }
                }}
              />
            </Tooltip>
          );
        })}
        {isWorkingDay && (
          <Tooltip title="🍽 Обед (14:00–15:00)" arrow placement="top" slotProps={{ tooltip: { sx: tooltipSx } }}>
            <Box sx={{ position: 'absolute', left: '44.444%', width: '11.111%', height: '100%', top: 0, backgroundColor: '#fef3c7', opacity: 0.8, zIndex: 1, cursor: 'pointer', borderRight: '1px solid rgba(0,0,0,0.05)', '&:hover': { opacity: 1 } }} />
          </Tooltip>
        )}
        {day.taskBlocks?.map((block, idx) => (
          <Box key={`label-${idx}`} sx={{ position: 'absolute', left: `${block.leftPercent + block.widthPercent / 2}%`, top: -22, transform: 'translateX(-50%)', backgroundColor: isHighlighted(block) ? '#f59e0b' : '#1e293b', color: 'white', fontSize: '10px', fontWeight: 500, padding: '2px 6px', borderRadius: '12px', whiteSpace: 'nowrap', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', zIndex: 15, pointerEvents: 'none', opacity: 0.9 }}>
            {block.hours.toFixed(1)}ч
          </Box>
        ))}
      </Box>

      {/* Дедлайны */}
      <Box sx={{ position: 'relative', height: 20, mb: 2 }}>
        {day.deadlines?.map((dl, idx) => {
          let leftPos = getLeft(dl.deadline);
          leftPos = Math.min(100, Math.max(0, leftPos));
          const taskInfoObj = getTaskInfoForDeadline(dl.taskId, dl.taskTitle, dl.status);
          let tooltipContent = <></>;
          if (dl.status === 'Completed') {
            tooltipContent = (<Box><Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><DoneAll sx={{ fontSize: 16, color: '#10b981' }} /><strong>{taskInfoObj?.title || dl.taskTitle}</strong></Box><Box sx={{ fontSize: 12, mt: 0.5 }}>✅ Выполнена</Box><Box sx={{ fontSize: 12, mt: 0.5 }}>📅 Дедлайн: {new Date(dl.deadline).toLocaleString()}</Box></Box>);
          } else if (dl.status === 'InProgress') {
            tooltipContent = (<Box><Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><PlayArrow sx={{ fontSize: 16, color: '#3b82f6' }} /><strong>{taskInfoObj?.title || dl.taskTitle}</strong></Box><Box sx={{ fontSize: 12, mt: 0.5 }}>⏱ В процессе выполнения</Box><Box sx={{ fontSize: 12, mt: 0.5 }}>📅 Дедлайн: {new Date(dl.deadline).toLocaleString()}</Box></Box>);
          } else if (dl.status === 'Assigned') {
            tooltipContent = (<Box><Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Assignment sx={{ fontSize: 16, color: '#f59e0b' }} /><strong>{taskInfoObj?.title || dl.taskTitle}</strong></Box><Box sx={{ fontSize: 12, mt: 0.5 }}>⏳ Назначена</Box><Box sx={{ fontSize: 12, mt: 0.5 }}>📅 Дедлайн: {new Date(dl.deadline).toLocaleString()}</Box></Box>);
          } else if (dl.status === 'Paused') {
            tooltipContent = (<Box><Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Pause sx={{ fontSize: 16, color: '#f59e0b' }} /><strong>{taskInfoObj?.title || dl.taskTitle}</strong></Box><Box sx={{ fontSize: 12, mt: 0.5 }}>⏸ Приостановлена</Box><Box sx={{ fontSize: 12, mt: 0.5 }}>📅 Дедлайн: {new Date(dl.deadline).toLocaleString()}</Box></Box>);
          } else {
            tooltipContent = (<Box>Дедлайн: {new Date(dl.deadline).toLocaleString()}</Box>);
          }
          return (
            <Tooltip key={idx} title={tooltipContent} arrow placement="top" slotProps={{ tooltip: { sx: tooltipSx } }}>
              <Box
                sx={{ position: 'absolute', left: `${leftPos}%`, top: -10, transform: 'translateX(-50%)', width: 4, height: 20, bgcolor: dl.status === 'Completed' ? '#10b981' : '#ef4444', borderRadius: 2, cursor: 'pointer', transition: 'all 0.2s ease', '&:hover': { width: 6, boxShadow: '0 0 4px rgba(0,0,0,0.3)' }, zIndex: 10 }}
                onMouseEnter={() => onTaskHover && onTaskHover(dl.taskId)}
                onMouseLeave={() => onTaskHover && onTaskHover(null)}
              />
            </Tooltip>
          );
        })}
      </Box>

      {/* Таймлайн реального выполнения с динамической высотой от бэкенда */}
      <Box sx={{ position: 'relative', bgcolor: '#f1f5f9', height: 36, borderRadius: 2, mb: 2, overflow: 'hidden', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)' }}>
        {isWorkingDay && (
          <Tooltip title="🍽 Обед (14:00–15:00)" arrow placement="top" slotProps={{ tooltip: { sx: tooltipSx } }}>
            <Box sx={{ position: 'absolute', left: '44.444%', width: '11.111%', height: '100%', top: 0, backgroundColor: '#fef3c7', opacity: 0.7, zIndex: 1, cursor: 'pointer', borderRight: '1px solid rgba(0,0,0,0.05)', '&:hover': { opacity: 0.9 } }} />
          </Tooltip>
        )}
        
        {workSegments.map((segment, idx) => {
          // Используем данные с бэкенда: layer и maxDepth
          const layer = segment.layer ?? 0;
          const maxDepth = segment.maxDepth ?? 1;
          const layerHeight = 36 / maxDepth;
          const topPos = layer * layerHeight;
          const segmentHeight = layerHeight - 1;
          return (
            <Tooltip
              key={`work-${idx}`}
              title={`${segment.taskTitle || `Задача #${segment.taskId}`}\n⏱ ${formatTime(segment.start)} - ${formatTime(segment.end)} (${getDuration(segment.start, segment.end)} ч)`}
              arrow
              placement="top"
              slotProps={{ tooltip: { sx: tooltipSx } }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  left: `${getLeft(segment.start)}%`,
                  width: `${getWidth(segment.start, segment.end)}%`,
                  height: `${segmentHeight}px`,
                  top: `${topPos}px`,
                  backgroundColor: getWorkColor(segment.taskId, segment.completed),
                  opacity: 0.85,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  borderRadius: '2px',
                  zIndex: 2,
                  '&:hover': { opacity: 1, filter: 'brightness(0.95)' }
                }}
              />
            </Tooltip>
          );
        })}
        
        {rawTimelineSegments.filter(s => s.type === 'idle').map((segment, idx) => {
          // Показываем idle, если в этом промежутке нет работы
          const hasWorkOverlap = workSegments.some(ws => ws.start < segment.end && ws.end > segment.start);
          if (hasWorkOverlap) return null;
          const idleTop = 36 - 4;
          const idleHeight = 4;
          return (
            <Tooltip
              key={`idle-${idx}`}
              title={`Простой\n⏱ ${formatTime(segment.start)} - ${formatTime(segment.end)} (${getDuration(segment.start, segment.end)} ч)`}
              arrow
              placement="top"
              slotProps={{ tooltip: { sx: tooltipSx } }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  left: `${getLeft(segment.start)}%`,
                  width: `${getWidth(segment.start, segment.end)}%`,
                  height: `${idleHeight}px`,
                  top: `${idleTop}px`,
                  backgroundColor: '#e2e8f0',
                  opacity: 0.7,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  zIndex: 1,
                  '&:hover': { opacity: 0.9 }
                }}
              />
            </Tooltip>
          );
        })}
      </Box>
    </Paper>
  );
}

function getLeft(dateTime) {
  const d = new Date(dateTime);
  const hours = d.getHours() + d.getMinutes() / 60;
  return ((hours - 10) / 9) * 100;
}

function getWidth(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  const duration = (e - s) / (1000 * 60 * 60);
  return (duration / 9) * 100;
}

function getDuration(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  return ((e - s) / (1000 * 60 * 60)).toFixed(1);
}