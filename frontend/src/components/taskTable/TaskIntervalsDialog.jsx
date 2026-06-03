import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography
} from '@mui/material';

/** Wall-clock YYYY-MM-DDTHH:mm for datetime-local (no timezone shift). */
function toInputValue(value) {
  if (!value) return '';
  const s = String(value);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}`;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function fromInputValue(value) {
  if (!value) return null;
  // Send wall-clock time without timezone so backend stores exact edited time.
  return value.length === 16 ? `${value}:00` : value;
}

export default function TaskIntervalsDialog({
  open,
  taskTitle,
  intervals,
  pending = false,
  onClose,
  onSave
}) {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (!open) return;
    setRows((intervals || []).map((i) => ({
      id: i.id,
      startTime: toInputValue(i.startTime),
      endTime: toInputValue(i.endTime),
      isOpen: !i.endTime
    })));
  }, [open, intervals]);

  const handleRowChange = (id, patch) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const handleSubmit = () => {
    const payload = rows.map((r) => ({
      id: r.id,
      startTime: fromInputValue(r.startTime),
      endTime: r.isOpen ? null : fromInputValue(r.endTime)
    }));
    onSave(payload);
  };

  return (
    <Dialog open={open} onClose={pending ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle>Интервалы</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {taskTitle || 'Выбранная задача'}
        </Typography>
        {rows.length === 0 ? (
          <Typography variant="body2" color="text.secondary">У задачи нет интервалов.</Typography>
        ) : (
          <Stack spacing={1.5}>
            {rows.map((r, idx) => (
              <Box key={`${r.id}-${idx}`} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 1.5 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Интервал #{idx + 1}</Typography>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
                  <TextField
                    label="Начало"
                    type="datetime-local"
                    value={r.startTime}
                    onChange={(e) => handleRowChange(r.id, { startTime: e.target.value })}
                    fullWidth
                    size="small"
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                  <TextField
                    label="Окончание"
                    type="datetime-local"
                    value={r.endTime}
                    onChange={(e) => handleRowChange(r.id, { endTime: e.target.value })}
                    fullWidth
                    size="small"
                    disabled={r.isOpen}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </Stack>
                <FormControlLabel
                  sx={{ mt: 1 }}
                  control={(
                    <Switch
                      checked={r.isOpen}
                      onChange={(e) => handleRowChange(r.id, { isOpen: e.target.checked })}
                    />
                  )}
                  label="Открытый интервал"
                />
              </Box>
            ))}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={pending}>Отмена</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={pending || rows.length === 0}>
          Сохранить
        </Button>
      </DialogActions>
    </Dialog>
  );
}
