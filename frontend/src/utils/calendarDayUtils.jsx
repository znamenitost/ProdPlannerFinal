import React from 'react';
import { alpha } from '@mui/material/styles';
import { STATUS_NO_ITEMS, STATUS_PENDING_APPROVAL } from '../constants/taskStatuses';
import { getTaskStatusLine, getTaskTitleSlashFile } from '../components/TaskTitleTwoLines';
import { getStatusIcon } from './taskHelpers';
import { chrome, tokens } from '../theme/paletteTokens';

export const CALENDAR_TOOLTIP_SX = {
  bgcolor: alpha(chrome.tooltipBg, 0.94),
  color: chrome.tooltipText,
  fontSize: '12px',
  padding: '8px 15px',
  minWidth: '350px',
  maxWidth: 'none',
  width: 'max-content',
  borderRadius: 2,
  boxShadow: '0 4px 16px rgba(74, 82, 96, 0.12)',
  whiteSpace: 'pre-line'
};

export const WORKDAY_START_HOUR = 10;
export const WORKDAY_END_HOUR = 19;
export const DETAIL_AXIS_START_HOUR = 10;
export const DETAIL_AXIS_END_HOUR = 19;

export function getTimelineRange(detailed = false) {
  if (detailed) {
    return { start: DETAIL_AXIS_START_HOUR, end: DETAIL_AXIS_END_HOUR };
  }
  return { start: WORKDAY_START_HOUR, end: WORKDAY_END_HOUR };
}

export function getLeft(dateTime, range = getTimelineRange(false)) {
  const d = new Date(dateTime);
  const hours = d.getHours() + d.getMinutes() / 60;
  const span = range.end - range.start;
  return ((hours - range.start) / span) * 100;
}

export function getWidth(start, end, range = getTimelineRange(false)) {
  const s = new Date(start);
  const e = new Date(end);
  const duration = (e - s) / (1000 * 60 * 60);
  const span = range.end - range.start;
  return (duration / span) * 100;
}

export function getLunchBandPercent(range = getTimelineRange(false)) {
  const span = range.end - range.start;
  const left = ((15 - range.start) / span) * 100;
  const width = (1 / span) * 100;
  return { left, width };
}

/** Локальный ключ даты YYYY-MM-DD (без сдвига UTC при сравнении с API). */
export function toCalendarDayKey(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Позиция «сейчас» на шкале 10–19; до/после рабочего окна — у края. */
export function getNowMarkerPercent(now, range = getTimelineRange(true)) {
  const hours = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
  const span = range.end - range.start;
  if (hours <= range.start) return 0;
  if (hours >= range.end) return 100;
  return ((hours - range.start) / span) * 100;
}

export function isSameCalendarDay(a, b) {
  return toCalendarDayKey(a) === toCalendarDayKey(b);
}

export function getDuration(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  return ((e - s) / (1000 * 60 * 60)).toFixed(1);
}

export function formatCalendarTime(dateTime) {
  return new Date(dateTime).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

/** Многострочный тултип: «задача / файл», статус с иконкой, доп. строка. */
export function formatCalendarTaskTooltip(task, extraLine) {
  const title = getTaskTitleSlashFile(task) || 'Задача';
  const statusLine = getTaskStatusLine(task);
  const statusIcon = statusLine ? getStatusIcon(statusLine, 14) : null;

  return (
    <span style={{ whiteSpace: 'pre-line' }}>
      <span>{title}</span>
      {statusLine && (
        <>
          {'\n'}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {statusIcon}{statusLine}
          </span>
        </>
      )}
      {extraLine && <>{'\n'}{extraLine}</>}
    </span>
  );
}

export function isWorkingWeekday(date) {
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

export function getWorkColor(taskId, completed) {
  if (completed) return tokens.workDone;
  return tokens.work[taskId % tokens.work.length];
}

export function getPlannedBlockColor(block, theme) {
  if (block?.statusText === STATUS_PENDING_APPROVAL || block?.statusText === 'На согласовании') {
    return theme.palette.secondary.main;
  }
  if (block?.statusText === STATUS_NO_ITEMS) return theme.palette.error.main;
  return null;
}

export function getTimelineSegments(dayDate, timeline) {
  if (!timeline?.length) return [];

  const date = new Date(dayDate);
  const segments = [];
  const lunchStart = new Date(date);
  lunchStart.setHours(15, 0, 0, 0);
  const lunchEnd = new Date(date);
  lunchEnd.setHours(16, 0, 0, 0);

  timeline.forEach((segment) => {
    const start = new Date(segment.start);
    const end = new Date(segment.end);

    if (segment.type === 'work') {
      if (start < lunchEnd && end > lunchStart) {
        if (start < lunchStart) {
          const beforeLunchEnd = end < lunchStart ? end : lunchStart;
          if (beforeLunchEnd > start) {
            segments.push({ ...segment, start, end: beforeLunchEnd });
          }
        }
        if (end > lunchEnd) {
          const afterLunchStart = start > lunchEnd ? start : lunchEnd;
          if (end > afterLunchStart) {
            segments.push({ ...segment, start: afterLunchStart, end });
          }
        }
      } else {
        segments.push({ ...segment, start, end });
      }
    } else {
      const isLunchTime =
        (start >= lunchStart && start < lunchEnd)
        || (end > lunchStart && end <= lunchEnd)
        || (start <= lunchStart && end >= lunchEnd);
      if (!isLunchTime) {
        segments.push({ ...segment, start, end });
      }
    }
  });

  return segments.sort((a, b) => new Date(a.start) - new Date(b.start));
}

export function buildTaskBlocksMap(allDays) {
  const taskBlocksMap = new Map();
  allDays?.forEach((d) => {
    d.taskBlocks?.forEach((block) => {
      if (!block.taskId) return;
      if (!taskBlocksMap.has(block.taskId)) taskBlocksMap.set(block.taskId, []);
      taskBlocksMap.get(block.taskId).push({ ...block, dayDate: d.date });
    });
  });
  return taskBlocksMap;
}

export function getTaskInfoForDeadline(taskBlocksMap, deadlineTaskId, deadlineTaskTitle, deadlineStatus) {
  if (deadlineStatus === 'Completed') {
    return {
      title: deadlineTaskTitle,
      totalHours: 0,
      blocksCount: 0,
      blocks: [],
      hasBlocks: false,
      isCompleted: true
    };
  }
  const blocks = taskBlocksMap.get(deadlineTaskId);
  if (blocks?.length) {
    const firstBlock = blocks[0];
    let totalHours = 0;
    blocks.forEach((b) => { totalHours += b.hours; });
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
    return {
      title: deadlineTaskTitle,
      totalHours: 0,
      blocksCount: 0,
      blocks: [],
      hasBlocks: false,
      isCompleted: false
    };
  }
  return null;
}
