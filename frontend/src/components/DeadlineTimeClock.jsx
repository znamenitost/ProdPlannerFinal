import { FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import {
  WORK_TIME_OPTIONS,
  formatHourAsTime,
  parseTimeToHour,
  DEFAULT_TIME
} from '../utils/dateTimeHelpers';

export default function DeadlineTimeClock({ value, onChange, disabled = false, size = 'small' }) {
  const selected = formatHourAsTime(parseTimeToHour(value || DEFAULT_TIME));

  return (
    <FormControl size={size} disabled={disabled} sx={{ minWidth: 108 }}>
      <InputLabel id="deadline-time-label">Время</InputLabel>
      <Select
        labelId="deadline-time-label"
        label="Время"
        value={selected}
        onChange={(e) => onChange(e.target.value)}
      >
        {WORK_TIME_OPTIONS.map((time) => (
          <MenuItem key={time} value={time}>
            {time}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
