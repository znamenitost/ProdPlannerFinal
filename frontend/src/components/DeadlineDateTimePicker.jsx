import { useMemo, useCallback } from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import {
  Box,
  Button,
  List,
  ListItemButton,
  ListItemText,
  Typography
} from '@mui/material';
import { CalendarMonth } from '@mui/icons-material';
import { DesktopDatePicker } from '@mui/x-date-pickers/DesktopDatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { usePickerContext } from '@mui/x-date-pickers/hooks';
import {
  usePickerLayout,
  PickersLayoutRoot,
  pickersLayoutClasses
} from '@mui/x-date-pickers/PickersLayout';
import {
  combineDateTime,
  DEFAULT_TIME,
  parseDateTime,
  WORK_TIME_OPTIONS
} from '../utils/dateTimeHelpers';

export { COL_DEADLINE_INPUT as DEADLINE_COLUMN_SX } from '../utils/taskTableStyles';

function toPickerValue(deadlineIso) {
  const { date, time } = parseDateTime(deadlineIso);
  if (!date) return null;
  const d = dayjs(date);
  if (!d.isValid()) return null;
  const [hours, minutes] = (time || DEFAULT_TIME).split(':').map(Number);
  return d.hour(hours).minute(minutes);
}

function DeadlineTimeActionList({ selectedTime, onSelectTime }) {
  const selected = selectedTime || DEFAULT_TIME;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minWidth: 88 }}>
      <Typography variant="caption" color="text.secondary" sx={{ px: 1, py: 0.75, fontWeight: 600 }}>
        Время
      </Typography>
      <List dense disablePadding sx={{ flex: 1, overflowY: 'auto', py: 0 }}>
        {WORK_TIME_OPTIONS.map((time) => (
          <ListItemButton
            key={time}
            selected={time === selected}
            onClick={() => onSelectTime(time)}
            sx={{ py: 0.6, borderRadius: 0.5, mx: 0.5 }}
          >
            <ListItemText
              primary={time}
              slotProps={{
                primary: {
                  variant: 'body2',
                  fontWeight: time === selected ? 600 : 400
                }
              }}
            />
          </ListItemButton>
        ))}
      </List>
    </Box>
  );
}

/** 2 колонки: календарь | время; 2-я строка: кнопка «Выбрать» на всю ширину */
function DeadlinePickerLayout(props) {
  const { toolbar, tabs, content, actionBar, ownerState } = usePickerLayout(props);
  const { acceptValueChanges } = usePickerContext();

  return (
    <PickersLayoutRoot
      className={pickersLayoutClasses.root}
      ownerState={ownerState}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        [`& .${pickersLayoutClasses.contentWrapper}`]: {
          display: 'contents'
        },
        [`& .${pickersLayoutClasses.actionBar}`]: {
          display: 'contents'
        }
      }}
    >
      {toolbar}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) auto',
          gridTemplateRows: 'auto auto',
          columnGap: 0,
          rowGap: 0
        }}
      >
        <Box
          sx={{
            gridColumn: 1,
            gridRow: 1,
            minWidth: 0,
            '& .MuiDateCalendar-root': { width: '100%', maxWidth: 320 }
          }}
        >
          {tabs}
          {content}
        </Box>

        <Box
          className={pickersLayoutClasses.actionBar}
          sx={{
            gridColumn: 2,
            gridRow: 1,
            borderLeft: 1,
            borderColor: 'divider',
            alignSelf: 'stretch',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {actionBar}
        </Box>

        <Box
          sx={{
            gridColumn: '1 / -1',
            gridRow: 2,
            borderTop: 1,
            borderColor: 'divider',
            display: 'flex',
            justifyContent: 'center',
            px: 2,
            py: 1.25,
            bgcolor: 'background.paper'
          }}
        >
          <Button variant="contained" size="small" onClick={() => acceptValueChanges()}>
            Выбрать
          </Button>
        </Box>
      </Box>
    </PickersLayoutRoot>
  );
}

export default function DeadlineDateTimePicker({
  value,
  onChange,
  disabled = false,
  size = 'small',
  label = 'Дедлайн',
  hideLabel = false,
  fullWidth = true
}) {
  const { date: dateStr, time: timeStr } = parseDateTime(value);
  const pickerValue = useMemo(() => toPickerValue(value), [value]);

  const emitChange = useCallback(
    (nextDate, nextTime) => {
      const d = nextDate?.isValid?.() ? nextDate.format('YYYY-MM-DD') : dateStr;
      const t = nextTime || timeStr || DEFAULT_TIME;
      if (d) onChange(combineDateTime(d, t));
    },
    [dateStr, timeStr, onChange]
  );

  const handlePickerChange = useCallback(
    (newDate) => {
      if (!newDate || !newDate.isValid()) return;
      emitChange(newDate, timeStr || DEFAULT_TIME);
    },
    [emitChange, timeStr]
  );

  const handleTimeSelect = useCallback(
    (time) => {
      emitChange(pickerValue || dayjs(), time);
    },
    [emitChange, pickerValue]
  );

  const TimeActionBar = useCallback(
    () => (
      <DeadlineTimeActionList
        selectedTime={timeStr}
        onSelectTime={handleTimeSelect}
      />
    ),
    [timeStr, handleTimeSelect]
  );

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="ru">
      <DesktopDatePicker
        value={pickerValue}
        onChange={handlePickerChange}
        disabled={disabled}
        format="DD.MM.YYYY"
        closeOnSelect={false}
        slots={{
          openPickerIcon: CalendarMonth,
          layout: DeadlinePickerLayout,
          actionBar: TimeActionBar
        }}
        slotProps={{
          field: {
            openPickerButtonPosition: 'end'
          },
          textField: {
            size,
            variant: 'outlined',
            label: hideLabel ? undefined : label,
            fullWidth
          },
          openPickerButton: {
            size: 'small'
          },
          openPickerIcon: {
            sx: { fontSize: 20, color: 'action.active' }
          },
          popper: {
            sx: {
              '& .MuiPaper-root': {
                borderRadius: 1,
                overflow: 'hidden'
              }
            }
          },
          desktopPaper: {
            sx: {
              borderRadius: 1,
              overflow: 'hidden'
            }
          }
        }}
      />
    </LocalizationProvider>
  );
}
