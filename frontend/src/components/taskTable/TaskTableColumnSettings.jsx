import { useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Divider,
  FormControlLabel,
  FormGroup,
  IconButton,
  Popover,
  Slider,
  Tooltip,
  Typography
} from '@mui/material';
import { Settings } from '@mui/icons-material';
import {
  TASK_TABLE_TOGGLEABLE_COLUMNS,
  TASK_TABLE_TEXT_LIMIT_MIN,
  TASK_TABLE_TEXT_LIMIT_MAX
} from '../../constants/taskTableColumnsConfig';

export default function TaskTableColumnSettings({
  visibility,
  onColumnVisibleChange,
  onReset,
  textLimit,
  onTextLimitChange
}) {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  return (
    <>
      <Tooltip title="Настройки колонок" arrow>
        <IconButton
          variant="soft"
          color="primary"
          onClick={(e) => setAnchorEl(e.currentTarget)}
          aria-label="Настройки колонок таблицы"
        >
          <Settings />
        </IconButton>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: { mt: 1, p: 2, minWidth: 220, maxWidth: 280 }
          }
        }}
      >
        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
          Колонки таблицы
        </Typography>
        <FormGroup sx={{ gap: 0 }}>
          {TASK_TABLE_TOGGLEABLE_COLUMNS.map(({ id, label }) => (
            <FormControlLabel
              key={id}
              control={
                <Checkbox
                  size="small"
                  checked={Boolean(visibility[id])}
                  onChange={(e) => onColumnVisibleChange(id, e.target.checked)}
                />
              }
              label={<Typography variant="body2">{label}</Typography>}
              sx={{ mx: 0, my: 0.25 }}
            />
          ))}
        </FormGroup>
        <Divider sx={{ my: 1.5 }} />
        <Typography variant="subtitle2" sx={{ mb: 0.5, fontWeight: 600 }}>
          Длина текста в ячейке
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 0.5 }}>
          <Slider
            value={textLimit}
            onChange={(_e, v) => onTextLimitChange(v)}
            min={TASK_TABLE_TEXT_LIMIT_MIN}
            max={TASK_TABLE_TEXT_LIMIT_MAX}
            step={1}
            size="small"
            valueLabelDisplay="auto"
            sx={{ flex: 1 }}
          />
          <Typography variant="body2" sx={{ minWidth: 28, textAlign: 'right', fontWeight: 500 }}>
            {textLimit}
          </Typography>
        </Box>
        <Divider sx={{ my: 1.5 }} />
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button size="small" onClick={onReset}>
            Сбросить
          </Button>
        </Box>
      </Popover>
    </>
  );
}
