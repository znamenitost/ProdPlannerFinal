import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  Typography,
  Alert,
  MenuItem,
  TextField
} from '@mui/material';
import { ContentCopy, Refresh, Article, Hub, Storage, Calculate } from '@mui/icons-material';
import { debugApi } from '../services/api';
import { useUiFeedback } from '../context/UiFeedbackContext';

const LEVEL_COLORS = {
  Warning: 'warning',
  Error: 'error',
  Critical: 'error'
};

const INTEGRITY_SEVERITY = {
  error: 'error',
  warning: 'warning',
  info: 'info'
};

function formatEntryForCopy(entry) {
  const lines = [
    `[${entry.timestamp}] ${entry.level} ${entry.category}: ${entry.message}`
  ];
  if (entry.details?.length) {
    lines.push(...entry.details);
  }
  return lines.join('\n');
}

export default function AdminLogsPage() {
  const { showSuccess, showError } = useUiFeedback();
  const [showWarning, setShowWarning] = useState(true);
  const [includeErrors, setIncludeErrors] = useState(true);
  const [tail, setTail] = useState(500);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [connections, setConnections] = useState(null);
  const [connectionsError, setConnectionsError] = useState('');
  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const [autoRefreshConnections, setAutoRefreshConnections] = useState(true);
  const [integrity, setIntegrity] = useState(null);
  const [integrityError, setIntegrityError] = useState('');
  const [integrityLoading, setIntegrityLoading] = useState(false);
  const [recalcLoading, setRecalcLoading] = useState(false);

  const loadIntegrity = useCallback(async () => {
    setIntegrityLoading(true);
    setIntegrityError('');
    try {
      const result = await debugApi.getDatabaseIntegrity();
      setIntegrity(result);
    } catch (err) {
      setIntegrityError(err.message || 'Не удалось проверить базу данных');
      setIntegrity(null);
    } finally {
      setIntegrityLoading(false);
    }
  }, []);

  const loadConnections = useCallback(async () => {
    setConnectionsLoading(true);
    setConnectionsError('');
    try {
      const result = await debugApi.getConnections();
      setConnections(result);
    } catch (err) {
      setConnectionsError(err.message || 'Не удалось загрузить метрики соединений');
    } finally {
      setConnectionsLoading(false);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const result = await debugApi.getLogs({
        warning: showWarning,
        error: includeErrors,
        tail
      });
      setData(result);
    } catch (err) {
      setLoadError(err.message || 'Не удалось загрузить журнал');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [showWarning, includeErrors, tail]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  useEffect(() => {
    loadIntegrity();
  }, [loadIntegrity]);

  useEffect(() => {
    if (!autoRefreshConnections) return undefined;
    const id = setInterval(loadConnections, 5000);
    return () => clearInterval(id);
  }, [autoRefreshConnections, loadConnections]);

  const entries = data?.entries ?? [];
  const copyText = useMemo(
    () => entries.map(formatEntryForCopy).join('\n\n'),
    [entries]
  );

  const handleRecalculateStatistics = async () => {
    setRecalcLoading(true);
    try {
      const result = await debugApi.recalculateStatistics();
      showSuccess(
        `Статистика пересчитана: задач ${result.tasksProcessed}, изменено часов ${result.tasksChanged}`
      );
      await loadIntegrity();
    } catch (err) {
      showError(err.message || 'Не удалось пересчитать статистику');
    } finally {
      setRecalcLoading(false);
    }
  };

  const integrityChecks = integrity?.checks ?? [];
  const integrityIssues = integrityChecks.filter((c) => c.count > 0);

  const handleCopy = async () => {
    if (!copyText) {
      showError('Нет записей для копирования');
      return;
    }
    try {
      await navigator.clipboard.writeText(copyText);
      showSuccess('Журнал скопирован в буфер обмена');
    } catch {
      showError('Не удалось скопировать');
    }
  };

  const fileSizeKb = data?.fileSizeBytes
    ? (data.fileSizeBytes / 1024).toFixed(1)
    : '0';

  const signalR = connections?.signalR;
  const memory = connections?.memory;
  const byUserEntries = signalR?.byUser
    ? Object.entries(signalR.byUser).sort((a, b) => b[1] - a[1])
    : [];

  return (
    <Stack spacing={2}>
      <Paper sx={{ p: 2.5, borderRadius: 2.5 }}>
        <Stack spacing={2}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2, justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Hub color="primary" />
              <Typography variant="h6" component="h2">
                SignalR и память
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={autoRefreshConnections}
                    onChange={(e) => setAutoRefreshConnections(e.target.checked)}
                  />
                }
                label="Авто 5 с"
              />
              <Button
                variant="outlined"
                size="small"
                startIcon={<Refresh />}
                onClick={loadConnections}
                disabled={connectionsLoading}
              >
                Обновить
              </Button>
            </Box>
          </Box>

          {connectionsError && (
            <Alert severity="error">{connectionsError}</Alert>
          )}

          {signalR && (
            <>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                <Chip label={`Активных: ${signalR.activeTotal}`} color="primary" variant="outlined" />
                <Chip label={`Открыто: ${signalR.totalOpened}`} variant="outlined" />
                <Chip label={`Закрыто: ${signalR.totalClosed}`} variant="outlined" />
                <Chip label={`Пользователей: ${signalR.usersOnline}`} variant="outlined" />
                {memory && (
                  <>
                    <Chip label={`Heap: ${memory.gcHeapMb} МБ`} variant="outlined" />
                    {memory.workingSetMb != null && (
                      <Chip label={`Working set: ${memory.workingSetMb} МБ`} variant="outlined" />
                    )}
                  </>
                )}
              </Box>

              {signalR.balance !== 0 && (
                <Alert severity="warning">
                  Баланс открытий/закрытий не сходится ({signalR.balance}). Возможна рассинхронизация учёта.
                </Alert>
              )}

              {byUserEntries.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    По пользователям (макс. {signalR.maxConnectionsPerUser} на пользователя)
                  </Typography>
                  <Stack direction="row" gap={1} sx={{ flexWrap: 'wrap' }}>
                    {byUserEntries.map(([userId, count]) => (
                      <Chip
                        key={userId}
                        size="small"
                        label={`${userId.slice(0, 8)}… · ${count}`}
                        color={count >= signalR.maxConnectionsPerUser ? 'warning' : 'default'}
                        variant="outlined"
                      />
                    ))}
                  </Stack>
                </Box>
              )}

            </>
          )}
        </Stack>
      </Paper>

      <Paper sx={{ p: 2.5, borderRadius: 2.5 }}>
        <Stack spacing={2}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2, justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Storage color="primary" />
              <Typography variant="h6" component="h2">
                Целостность базы данных
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<Refresh />}
                onClick={loadIntegrity}
                disabled={integrityLoading}
              >
                Проверить
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<Calculate />}
                onClick={handleRecalculateStatistics}
                disabled={recalcLoading}
              >
                Пересчитать статистику
              </Button>
            </Box>
          </Box>

          {integrityError && (
            <Alert severity="error">{integrityError}</Alert>
          )}

          {integrity && (
            <>
              <Alert severity={integrity.ok ? 'success' : 'warning'}>
                {integrity.ok
                  ? 'Проблемных записей не найдено.'
                  : `Найдено проверок с замечаниями: ${integrityIssues.length}.`}
              </Alert>

              {integrityIssues.length > 0 && (
                <Stack spacing={1.5}>
                  {integrityIssues.map((check) => (
                    <Box
                      key={check.id}
                      sx={{
                        p: 1.5,
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: 'divider'
                      }}
                    >
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Chip
                          size="small"
                          label={check.severity}
                          color={INTEGRITY_SEVERITY[check.severity] ?? 'default'}
                          variant="outlined"
                        />
                        <Typography variant="subtitle2">{check.title}</Typography>
                        <Chip size="small" label={`${check.count}`} color="default" />
                      </Box>
                      {check.hint && (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                          {check.hint}
                        </Typography>
                      )}
                      {check.samples?.length > 0 ? (
                        <Stack spacing={0.75} sx={{ mt: 0.5 }}>
                          {check.samples.map((sample) => (
                            <Typography
                              key={`${check.id}-${sample.id}-${sample.file}`}
                              variant="caption"
                              color="text.secondary"
                              component="div"
                              sx={{ lineHeight: 1.5 }}
                            >
                              <Box component="span" sx={{ fontFamily: 'monospace', mr: 1 }}>
                                #{sample.id}
                              </Box>
                              <Box component="span" sx={{ fontWeight: 600, color: 'text.primary', mr: 1 }}>
                                {sample.title}
                              </Box>
                              <Box component="span">{sample.file}</Box>
                              {sample.note && (
                                <Box component="span" sx={{ display: 'block', mt: 0.25 }}>
                                  {sample.note}
                                </Box>
                              )}
                            </Typography>
                          ))}
                          {check.count > check.samples.length && (
                            <Typography variant="caption" color="text.secondary">
                              … ещё {check.count - check.samples.length}
                            </Typography>
                          )}
                        </Stack>
                      ) : check.sampleIds?.length > 0 ? (
                        <Typography variant="caption" color="text.secondary" component="div">
                          ID: {check.sampleIds.join(', ')}
                          {check.count > check.sampleIds.length
                            ? ` … ещё ${check.count - check.sampleIds.length}`
                            : ''}
                        </Typography>
                      ) : null}
                    </Box>
                  ))}
                </Stack>
              )}
            </>
          )}
        </Stack>
      </Paper>

    <Paper sx={{ p: 2.5, borderRadius: 2.5 }}>
      <Stack spacing={2}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2, justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Article color="primary" />
            <Typography variant="h6" component="h2">
              Журнал приложения
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            {data?.path ?? 'logs/app.log'} · {fileSizeKb} КБ · записей: {entries.length}
          </Typography>
        </Box>

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{ flexWrap: 'wrap', alignItems: { sm: 'center' } }}
        >
          <FormControlLabel
            control={
              <Switch
                checked={showWarning}
                onChange={(e) => setShowWarning(e.target.checked)}
                color="warning"
              />
            }
            label="Предупреждения"
          />
          <FormControlLabel
            control={
              <Switch
                checked={includeErrors}
                onChange={(e) => setIncludeErrors(e.target.checked)}
                color="error"
              />
            }
            label="Ошибки"
          />
          <TextField
            select
            size="small"
            label="Последние записи"
            value={tail}
            onChange={(e) => setTail(Number(e.target.value))}
            sx={{ minWidth: 160 }}
          >
            {[100, 300, 500, 1000, 2000].map((n) => (
              <MenuItem key={n} value={n}>{n}</MenuItem>
            ))}
          </TextField>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={loadLogs}
              disabled={loading}
            >
              Обновить
            </Button>
            <Button
              variant="contained"
              startIcon={<ContentCopy />}
              onClick={handleCopy}
              disabled={!entries.length}
            >
              Скопировать
            </Button>
          </Box>
        </Stack>

        {!showWarning && !includeErrors && (
          <Alert severity="info">Включите хотя бы один фильтр уровня.</Alert>
        )}

        {loadError && (
          <Alert severity="error">{loadError}</Alert>
        )}

        <Box
          component="pre"
          sx={{
            m: 0,
            p: 2,
            borderRadius: 1,
            bgcolor: 'action.hover',
            overflow: 'auto',
            maxHeight: 'calc(100vh - 340px)',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            fontSize: '0.8rem',
            lineHeight: 1.45,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }}
        >
          {entries.length === 0 && !loading && !loadError && (
            <Typography component="span" color="text.secondary">
              Записей с выбранными фильтрами нет.
            </Typography>
          )}
          {entries.map((entry, index) => (
            <Box key={`${entry.timestamp}-${index}`} sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Chip
                  size="small"
                  label={entry.level}
                  color={LEVEL_COLORS[entry.level] ?? 'default'}
                  variant="outlined"
                />
                <Typography component="span" variant="caption" color="text.secondary">
                  {entry.timestamp}
                </Typography>
              </Box>
              <Box>{entry.category}: {entry.message}</Box>
              {entry.details?.map((line, i) => (
                <Box key={i} sx={{ color: 'text.secondary' }}>{line}</Box>
              ))}
            </Box>
          ))}
        </Box>
      </Stack>
    </Paper>
    </Stack>
  );
}
