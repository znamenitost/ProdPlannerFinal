import { useEffect, useRef, useState } from 'react';
import { Box, IconButton, InputAdornment, TextField, Tooltip } from '@mui/material';
import { Clear, Search } from '@mui/icons-material';

export default function ExpandableSearchField({
  value,
  onChange,
  placeholder = 'Задача или файл'
}) {
  const [open, setOpen] = useState(Boolean(value));
  const inputRef = useRef(null);

  useEffect(() => {
    if (value) setOpen(true);
  }, [value]);

  useEffect(() => {
    if (open) {
      const timer = window.setTimeout(() => inputRef.current?.focus(), 120);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [open]);

  const handleToggle = () => {
    if (open && !value) {
      setOpen(false);
      return;
    }
    setOpen(true);
  };

  const handleBlur = () => {
    if (!value) setOpen(false);
  };

  const handleClear = () => {
    onChange('');
    inputRef.current?.focus();
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Box
        sx={(theme) => ({
          width: open ? { xs: 128, sm: 180, md: 220 } : 0,
          opacity: open ? 1 : 0,
          overflow: 'hidden',
          transition: theme.transitions.create(['width', 'opacity'], {
            duration: theme.transitions.duration.short
          })
        })}
      >
        <TextField
          inputRef={inputRef}
          size="small"
          fullWidth
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={handleBlur}
          placeholder={placeholder}
          aria-label="Поиск по задаче и файлу"
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" color="action" />
                </InputAdornment>
              ),
              endAdornment: value ? (
                <InputAdornment position="end">
                  <IconButton size="small" onMouseDown={(e) => e.preventDefault()} onClick={handleClear} aria-label="Очистить поиск">
                    <Clear fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null
            }
          }}
        />
      </Box>
      <Tooltip title="Поиск по задаче и файлу">
        <IconButton
          variant="soft"
          color={open || value ? 'primary' : 'default'}
          onClick={handleToggle}
          aria-label="Поиск по задаче и файлу"
          aria-expanded={open}
          sx={
            open || value
              ? { border: '1px solid', borderColor: 'primary.main' }
              : undefined
          }
        >
          <Search />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
