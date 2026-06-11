import { Box } from '@mui/material';
import { Remove, Add } from '@mui/icons-material';
import { NumberField } from '@base-ui/react/number-field';

import {
  ESTIMATE_HOURS_MIN,
  ESTIMATE_HOURS_MAX,
  ESTIMATE_HOURS_STEP
} from '../constants';

export { ESTIMATE_HOURS_MIN, ESTIMATE_HOURS_MAX, ESTIMATE_HOURS_STEP };

export function clampEstimateHours(value) {
  return clampEstimateHoursToRange(value);
}

export function clampEstimateHoursToRange(
  value,
  min = ESTIMATE_HOURS_MIN,
  max = ESTIMATE_HOURS_MAX
) {
  if (value === '' || value == null) return '';
  const num = typeof value === 'number' ? value : parseFloat(value);
  if (!Number.isFinite(num)) return '';
  const stepped = Math.round(num / ESTIMATE_HOURS_STEP) * ESTIMATE_HOURS_STEP;
  return Math.min(max, Math.max(min, stepped));
}

// 2× кнопка (30) + поле (48) + рамка; minWidth не даёт родителю обрезать «+»
const FIELD_MIN_WIDTH = 112;

const fieldSx = {
  display: 'inline-flex',
  alignItems: 'stretch',
  width: 'fit-content',
  minWidth: FIELD_MIN_WIDTH,
  border: 1,
  borderColor: 'divider',
  borderRadius: 1,
  bgcolor: 'transparent',
  overflow: 'hidden',
  '& [data-disabled]': {
    opacity: 0.45,
    cursor: 'not-allowed',
  },
  '& button': {
    border: 'none',
    background: 'transparent',
    color: 'text.secondary',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 30,
    px: 0.5,
    flexShrink: 0,
    '&:hover:not([data-disabled])': {
      bgcolor: 'action.hover',
      color: 'text.primary',
    },
  },
  '& input': {
    width: 48,
    border: 'none',
    borderLeft: 1,
    borderRight: 1,
    borderColor: 'divider',
    textAlign: 'center',
    fontSize: '0.875rem',
    fontFamily: 'inherit',
    outline: 'none',
    py: 0.75,
    px: 0.5,
    bgcolor: 'transparent',
    color: 'text.primary',
    MozAppearance: 'textfield',
    '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': {
      WebkitAppearance: 'none',
      margin: 0,
    },
  },
};

export default function EstimateHoursInput({
  value,
  onChange,
  disabled = false,
  allowEmpty = false,
  placeholder,
  min = ESTIMATE_HOURS_MIN,
  max = ESTIMATE_HOURS_MAX,
  sx,
}) {
  const numericValue =
    value === '' || value == null ? null : Number(value);

  const handleValueChange = (nextValue) => {
    if (nextValue == null) {
      onChange(allowEmpty ? '' : min);
      return;
    }
    onChange(clampEstimateHoursToRange(nextValue, min, max));
  };

  return (
    <Box sx={{ ...fieldSx, ...sx, minWidth: FIELD_MIN_WIDTH }}>
      <NumberField.Root
        value={numericValue}
        onValueChange={handleValueChange}
        min={min}
        max={max}
        step={ESTIMATE_HOURS_STEP}
        snapOnStep
        disabled={disabled}
        format={{ minimumFractionDigits: 0, maximumFractionDigits: 1 }}
      >
        <NumberField.Group style={{ display: 'flex', alignItems: 'stretch', width: '100%' }}>
          <NumberField.Decrement aria-label="Уменьшить">
            <Remove sx={{ fontSize: 18 }} />
          </NumberField.Decrement>
          <NumberField.Input placeholder={placeholder} />
          <NumberField.Increment aria-label="Увеличить">
            <Add sx={{ fontSize: 18 }} />
          </NumberField.Increment>
        </NumberField.Group>
      </NumberField.Root>
    </Box>
  );
}
