import React from 'react';
import { alpha } from '@mui/material/styles';
import { STATUS_NO_ITEMS, STATUS_PENDING_APPROVAL } from '../constants/taskStatuses';
import { getTaskStatusLine, getTaskTitleSlashFile } from '../components/TaskTitleTwoLines';
import { chrome, tokens } from '../theme/paletteTokens';
import { getStatusIcon } from './taskHelpers';
import { mergeWorkSegmentsByTask } from './calendarTimelineMerge';

export { mergeWorkSegmentsByTask };

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

export function getIntervalBandPercent(start, end, range = getTimelineRange(false)) {
  const s = new Date(start);
  const e = new Date(end);
  const span = range.end - range.start;
  const startHour = s.getHours() + s.getMinutes() / 60;
  const endHour = e.getHours() + e.getMinutes() / 60;
  const left = ((startHour - range.start) / span) * 100;
  const width = ((endHour - startHour) / span) * 100;
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

/** Разбор YYYY-MM-DD в локальную полночь (без UTC-сдвига). */
export function parseCalendarDayKey(key) {
  if (!key || typeof key !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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

/** Сегменты «Суеты» — те же цвета, но полупрозрачные. */
export function isFussTimelineSegment(segment) {
  if (segment?.isFuss) return true;
  const fileName = String(segment?.fileName || '');
  const title = String(segment?.taskTitle || '');
  return fileName.startsWith('Суета') || title.startsWith('Суета');
}

export const FUSS_TIMELINE_OPACITY = 0.5;

export function getPlannedBlockColor(block, theme) {
  if (block?.statusText === STATUS_PENDING_APPROVAL || block?.statusText === 'На согласовании') {
    return theme.palette.warning.main;
  }
  if (block?.statusText === STATUS_NO_ITEMS) return theme.palette.error.main;
  return null;
}

export function getTimelineSegments(timeline) {
  if (!timeline?.length) return [];

  const segments = timeline.map((segment) => ({
    ...segment,
    start: new Date(segment.start),
    end: new Date(segment.end),
    isOpenInterval: Boolean(segment.isOpenInterval)
  }));

  return segments.sort((a, b) => new Date(a.start) - new Date(b.start));
}

function getWorkdayEnd(dayDate) {
  const end = new Date(dayDate);
  end.setHours(WORKDAY_END_HOUR, 0, 0, 0);
  return end;
}

/** Продлевает открытые work-сегменты до «сейчас» и убирает idle, перекрытый работой. */
export function extendTimelineToNow(segments, dayDate, now = new Date()) {
  const coalesced = mergeWorkSegmentsByTask(segments);
  if (!coalesced?.length || !isSameCalendarDay(dayDate, now)) return coalesced;

  const workdayEnd = getWorkdayEnd(dayDate);
  const liveEnd = now > workdayEnd ? workdayEnd : now;

  const extendedWork = coalesced.map((segment) => {
    if (segment.type !== 'work' || !segment.isOpenInterval) return segment;
    if (liveEnd <= segment.end) return segment;
    return { ...segment, end: liveEnd };
  });

  const work = extendedWork.filter((s) => s.type === 'work');
  const withoutOverlappingIdle = extendedWork.filter((segment) => {
    if (segment.type !== 'idle') return true;
    return !work.some((w) => w.start < segment.end && w.end > segment.start);
  });

  return withoutOverlappingIdle.sort((a, b) => a.start - b.start);
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
