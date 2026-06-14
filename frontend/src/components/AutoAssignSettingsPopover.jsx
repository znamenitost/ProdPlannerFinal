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
  Tooltip,
  Typography
} from '@mui/material';
import { Settings } from '@mui/icons-material';
import { createDefaultAutoAssignTypeRules } from '../utils/autoAssignTypeRules';

export default function AutoAssignSettingsPopover({
  rules,
  onRulesChange,
  employees,
  taskTypes
}) {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const toggleType = (employee, type) => {
    const current = rules[employee] ?? [];
    const nextTypes = current.includes(type)
      ? current.filter((item) => item !== type)
      : [...current, type];
    onRulesChange({ ...rules, [employee]: nextTypes });
  };

  const handleReset = () => {
    onRulesChange(createDefaultAutoAssignTypeRules(employees, taskTypes));
  };

  return (
    <>
      <Tooltip title="Настройки авто-выбора" arrow>
        <IconButton
          size="small"
          onClick={(event) => setAnchorEl(event.currentTarget)}
          aria-label="Настройки авто-выбора сотрудников"
          sx={{ ml: 0.25 }}
        >
          <Settings fontSize="small" />
        </IconButton>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: { mt: 0.5, p: 2, minWidth: 280, maxWidth: 360, maxHeight: '70vh', overflow: 'auto' }
          }
        }}
      >
        <Typography variant="subtitle2" sx={{ mb: 0.5, fontWeight: 600 }}>
          Типы работ для авто-выбора
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
          Сотрудник назначается только если может выполнить все выбранные типы части.
          Балансировка — по числу активных задач и сумме часов.
        </Typography>

        {employees.map((employee) => (
          <Box key={employee} sx={{ mb: 1.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
              {employee}
            </Typography>
            <FormGroup sx={{ gap: 0 }}>
              {taskTypes.map((type) => (
                <FormControlLabel
                  key={`${employee}-${type}`}
                  control={
                    <Checkbox
                      size="small"
                      checked={Boolean(rules[employee]?.includes(type))}
                      onChange={() => toggleType(employee, type)}
                    />
                  }
                  label={<Typography variant="body2">{type}</Typography>}
                  sx={{ mx: 0, my: 0.15 }}
                />
              ))}
            </FormGroup>
          </Box>
        ))}

        <Divider sx={{ my: 1.5 }} />
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button size="small" onClick={handleReset}>
            Сбросить
          </Button>
        </Box>
      </Popover>
    </>
  );
}
