import { useState, useEffect } from 'react';
import { Alert, AlertTitle, Stack, Collapse, IconButton } from '@mui/material';
import { Warning, Error, Close, AccessTime, Flag, Event } from '@mui/icons-material';
import TaskTitleTwoLines from './TaskTitleTwoLines';
import { useUiFeedback } from '../context/UiFeedbackContext';
import useDeadlineRisksQuery from '../hooks/queries/useDeadlineRisksQuery';

export default function DeadlineWarnings({ employee }) {
  const { showError } = useUiFeedback();
  const [open, setOpen] = useState(true);
  const { data: risks = [], isPending, isError, isFetching } = useDeadlineRisksQuery(employee);

  useEffect(() => {
    if (isError) {
      showError('Не удалось загрузить предупреждения по дедлайнам');
    }
  }, [isError, showError]);

  useEffect(() => {
    if (risks.length > 0) {
      setOpen(true);
    }
  }, [risks.length]);

  if ((isPending || isFetching) && risks.length === 0) return null;
  if (risks.length === 0) return null;

  return (
    <Collapse in={open}>
      <Stack sx={{ mb: 3 }} spacing={1}>
        {risks.map((risk) => {
          let severity = 'warning';
          let icon = <Warning fontSize="inherit" />;
          let title = 'Дедлайн приближается';

          if (risk.riskLevel === 'overdue') {
            severity = 'error';
            icon = <Flag fontSize="inherit" />;
            title = 'Дедлайн сорван';
          } else if (risk.riskLevel === 'critical') {
            severity = 'error';
            icon = <Error fontSize="inherit" />;
            title = 'Критично';
          }

          let shortMessage = '';
          if (risk.riskLevel === 'overdue') {
            shortMessage = 'Задача просрочена';
          } else if (risk.riskLevel === 'critical') {
            const deficit = risk.requiredHours - risk.availableHoursBeforeDeadline;
            shortMessage = `Не хватает ${Math.round(deficit)} ч`;
          } else {
            shortMessage = `Осталось ${Math.round(risk.availableHoursBeforeDeadline)} из ${Math.round(risk.requiredHours)} ч`;
          }

          const riskTask = {
            folderPath: risk.taskTitle,
            heading: risk.taskTitle,
            fileName: risk.fileName
          };

          return (
            <Alert
              key={risk.taskId}
              severity={severity}
              icon={icon}
              sx={{
                borderRadius: 2,
                '& .MuiAlert-icon': { alignItems: 'center' }
              }}
              action={
                <IconButton size="small" onClick={() => setOpen(false)}>
                  <Close fontSize="small" />
                </IconButton>
              }
            >
              <AlertTitle sx={{ fontWeight: 600, fontSize: '0.9rem', mb: 0.5 }}>
                {title}
              </AlertTitle>

              <TaskTitleTwoLines
                task={riskTask}
                headingVariant="body2"
                statusVariant="body2"
                headingSx={{ fontWeight: 600 }}
                statusSx={{ color: 'text.secondary', mt: 0.25 }}
              />

              <Stack
                direction="row"
                spacing={2}
                sx={{ mt: 1, fontSize: '0.8rem', color: 'text.secondary', alignItems: 'center' }}
              >
                <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                  <AccessTime sx={{ fontSize: 14 }} />
                  <span>{shortMessage}</span>
                </Stack>
                <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                  <Event sx={{ fontSize: 14 }} />
                  <span>
                    {new Date(risk.deadline).toLocaleDateString()}{' '}
                    {new Date(risk.deadline).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </Stack>
              </Stack>
            </Alert>
          );
        })}
      </Stack>
    </Collapse>
  );
}
