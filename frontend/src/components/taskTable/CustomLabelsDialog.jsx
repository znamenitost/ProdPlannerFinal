import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import { Add, Delete, Print, Save } from '@mui/icons-material';
import { getCustomLabelSheet, printCustomLabels, saveCustomLabelSheet } from '../../services/api';
import { useUiFeedback } from '../../context/UiFeedbackContext';

const MAX_QUANTITY = 200;

function clampQuantity(value) {
  const n = Number.parseInt(String(value).trim(), 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, MAX_QUANTITY);
}

const isNumericCell = (value) => {
  const v = String(value ?? '').trim();
  return v !== '' && !Number.isNaN(Number(v));
};

/**
 * Разбор вставленного из Excel текста.
 * Поддерживается исходный макет файла (Ширина | Кол-во | … | Подпись | Регион | Клиент | Примечание)
 * и компактный порядок столбцов таблицы (Подпись | Регион | Примечание | Кол-во).
 * Исходный макет распознаётся по числовой «Ширине» и пустому столбцу C — так работает
 * и вставка диапазона с обрезанными пустыми хвостовыми столбцами (5–6 ячеек вместо 7).
 */
export function parseLabelsClipboard(text) {
  const rows = [];
  const lines = String(text || '').split(/\r\n|\r|\n/);
  for (const rawLine of lines) {
    if (!rawLine || !rawLine.trim()) continue;
    const cells = rawLine.split('\t').map((c) => c.trim());
    // Пропускаем строку заголовков.
    if (cells.some((c) => c === 'Подпись' || c === 'Ширина надписи' || c === 'Кол-во')) continue;

    let caption = '';
    let region = '';
    let note = '';
    let quantity = 1;

    // В исходном файле столбец A (Ширина) всегда число, а C — пустой.
    const isExcelSourceLayout = cells.length >= 5 && isNumericCell(cells[0]) && cells[2] === '';
    if (isExcelSourceLayout) {
      quantity = clampQuantity(cells[1]);
      caption = cells[3] || '';
      region = cells[4] || '';
      note = cells[6] || '';
    } else if (cells.length >= 4) {
      [caption, region, note] = cells;
      quantity = clampQuantity(cells[3]);
    } else if (cells.length === 3) {
      [caption, region, note] = cells;
    } else if (cells.length === 2) {
      [caption, region] = cells;
    } else {
      caption = cells[0] || '';
    }

    if (!caption && !region && !note) continue;
    rows.push({ caption, region, note, quantity });
  }
  return rows;
}

export default function CustomLabelsDialog({ open, onClose }) {
  const { showSuccess, showError } = useUiFeedback();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false);
  const keyCounter = useRef(0);

  const nextKey = () => `row-${++keyCounter.current}`;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    getCustomLabelSheet()
      .then((sheet) => {
        if (cancelled) return;
        const loaded = (sheet?.rows || []).map((r) => ({
          key: nextKey(),
          caption: r.caption || '',
          region: r.region || '',
          note: r.note || '',
          quantity: clampQuantity(r.quantity)
        }));
        setRows(loaded.length > 0 ? loaded : [{ key: nextKey(), caption: '', region: '', note: '', quantity: 1 }]);
      })
      .catch((err) => {
        if (cancelled) return;
        showError(err.message || 'Не удалось загрузить таблицу наклеек');
        setRows([{ key: nextKey(), caption: '', region: '', note: '', quantity: 1 }]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRowChange = (key, patch) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const handleAddRow = () => {
    setRows((prev) => [...prev, { key: nextKey(), caption: '', region: '', note: '', quantity: 1 }]);
  };

  const handleDeleteRow = (key) => {
    setRows((prev) => {
      const next = prev.filter((r) => r.key !== key);
      return next.length > 0 ? next : [{ key: nextKey(), caption: '', region: '', note: '', quantity: 1 }];
    });
  };

  // Вставка диапазона из Excel в любое место диалога (вне текстового поля).
  const handlePaste = useCallback((event) => {
    const tag = event.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    const text = event.clipboardData?.getData('text/plain');
    if (!text) return;
    const parsed = parseLabelsClipboard(text);
    if (parsed.length === 0) return;
    event.preventDefault();
    setRows((prev) => {
      const nonEmpty = prev.filter((r) => r.caption || r.region || r.note);
      return [...nonEmpty, ...parsed.map((r) => ({ ...r, key: nextKey() }))];
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const buildPayload = () => rows
    .filter((r) => r.caption.trim() || r.region.trim() || r.note.trim())
    .map((r) => ({
      caption: r.caption.trim(),
      region: r.region.trim(),
      note: r.note.trim(),
      quantity: clampQuantity(r.quantity)
    }));

  const handleSave = async () => {
    if (saving || printing) return;
    setSaving(true);
    try {
      const payload = buildPayload();
      await saveCustomLabelSheet(payload);
      showSuccess(`Таблица наклеек сохранена (${payload.length} строк)`);
    } catch (err) {
      showError(err.message || 'Не удалось сохранить таблицу наклеек');
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = async () => {
    if (saving || printing) return;
    const payload = buildPayload();
    if (payload.length === 0) {
      showError('Добавьте хотя бы одну заполненную строку');
      return;
    }
    setPrinting(true);
    try {
      const result = await printCustomLabels(payload);
      const total = Number(result?.totalCopies ?? 0);
      showSuccess(total > 0
        ? `Отправлено на печать: ${total} наклеек`
        : 'Наклейки отправлены на печать');
    } catch (err) {
      showError(err.message || 'Не удалось отправить наклейки на печать');
    } finally {
      setPrinting(false);
    }
  };

  const totalStickers = rows.reduce((sum, r) => {
    if (!r.caption.trim() && !r.region.trim() && !r.note.trim()) return sum;
    return sum + clampQuantity(r.quantity);
  }, 0);

  const busy = saving || printing;

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="lg" fullWidth>
      <DialogTitle>Наклейки 58×30 мм</DialogTitle>
      <DialogContent dividers onPaste={handlePaste}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Каждая строка печатается в 3 строки: Подпись / Регион / Примечание, тираж — из столбца «Кол-во».
          Строки можно вставить прямо из Excel: скопируйте диапазон и нажмите Ctrl+V в этом окне.
        </Typography>
        <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 40 }}>#</TableCell>
                <TableCell>Подпись</TableCell>
                <TableCell sx={{ width: 180 }}>Регион</TableCell>
                <TableCell sx={{ width: 220 }}>Примечание</TableCell>
                <TableCell sx={{ width: 96 }} align="center">Кол-во</TableCell>
                <TableCell sx={{ width: 48 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row, idx) => (
                <TableRow key={row.key} hover>
                  <TableCell sx={{ color: 'text.secondary' }}>{idx + 1}</TableCell>
                  <TableCell>
                    <TextField
                      value={row.caption}
                      onChange={(e) => handleRowChange(row.key, { caption: e.target.value })}
                      size="small"
                      fullWidth
                      placeholder="Ушаков 350*1800"
                      slotProps={{ htmlInput: { maxLength: 200 } }}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      value={row.region}
                      onChange={(e) => handleRowChange(row.key, { region: e.target.value })}
                      size="small"
                      fullWidth
                      placeholder="Москва"
                      slotProps={{ htmlInput: { maxLength: 200 } }}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      value={row.note}
                      onChange={(e) => handleRowChange(row.key, { note: e.target.value })}
                      size="small"
                      fullWidth
                      placeholder="слово RUCETTI"
                      slotProps={{ htmlInput: { maxLength: 200 } }}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <TextField
                      value={row.quantity}
                      onChange={(e) => handleRowChange(row.key, { quantity: clampQuantity(e.target.value) })}
                      type="number"
                      size="small"
                      slotProps={{ htmlInput: { min: 1, max: MAX_QUANTITY, step: 1, style: { textAlign: 'center' } } }}
                      sx={{ width: 76 }}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="Удалить строку">
                      <IconButton size="small" onClick={() => handleDeleteRow(row.key)} aria-label="Удалить строку">
                        <Delete fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1.5 }}>
          <Button startIcon={<Add />} onClick={handleAddRow} disabled={busy || loading}>
            Добавить строку
          </Button>
          <Typography variant="body2" color="text.secondary">
            Всего наклеек: {totalStickers}
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Закрыть</Button>
        <Button
          startIcon={<Save />}
          onClick={handleSave}
          disabled={busy || loading}
        >
          Сохранить
        </Button>
        <Button
          variant="contained"
          startIcon={<Print />}
          onClick={handlePrint}
          disabled={busy || loading}
        >
          Печать
        </Button>
      </DialogActions>
    </Dialog>
  );
}
