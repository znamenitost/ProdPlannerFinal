import { useEffect, useRef, useState } from 'react';
import { Box, IconButton, InputAdornment, TextField, Tooltip } from '@mui/material';
import { Clear, Search } from '@mui/icons-material';

export default function ExpandableSearchField({
  value,
  onChange,
  placeholder = 'Задача или файл',
  tooltip = 'Поиск по задаче и файлу',
  onEnterKey,
  forceOpen = false,
  width
}) {
  const [open, setOpen] = useState(Boolean(value));
  const inputRef = useRef(null);
  const isOpen = forceOpen || open;

  useEffect(() => {
    if (value) setOpen(true);
  }, [value]);

  useEffect(() => {
    if (isOpen) {
      const timer = window.setTimeout(() => inputRef.current?.focus(), 120);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [isOpen]);

  const handleToggle = () => {
    if (open && !value) {
      setOpen(false);
      return;
    }
    setOpen(true);
  };

  const handleBlur = () => {
    if (!forceOpen && !value) setOpen(false);
  };

  const handleClear = () => {
    onChange('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Escape' && value) {
      event.stopPropagation();
      handleClear();
      return;
    }
    if (event.key === 'Enter' && onEnterKey) {
      event.preventDefault();
      onEnterKey();
    }
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Box
        sx={(theme) => ({
          width: isOpen ? (width ?? { xs: 128, sm: 180, md: 220 }) : 0,
          opacity: isOpen ? 1 : 0,
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
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label={tooltip}
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
      {!forceOpen && (
        <Tooltip title={tooltip}>
          <IconButton
            variant="soft"
            color={isOpen || value ? 'primary' : 'default'}
            onClick={handleToggle}
            aria-label={tooltip}
            aria-expanded={isOpen}
            sx={
              isOpen || value
                ? { border: '1px solid', borderColor: 'primary.main' }
                : undefined
            }
          >
            <Search />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
}
