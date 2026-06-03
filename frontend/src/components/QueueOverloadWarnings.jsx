import { useState, useEffect } from 'react';
import { Alert, AlertTitle, Stack, Collapse, IconButton } from '@mui/material';
import { Close, Event, Schedule, Queue } from '@mui/icons-material';
import TaskTitleTwoLines from './TaskTitleTwoLines';
import { useUiFeedback } from '../context/UiFeedbackContext';
import useQueueOverloadsQuery from '../hooks/queries/useQueueOverloadsQuery';

export default function QueueOverloadWarnings({ employee }) {
  const { showError } = useUiFeedback();
  const [open, setOpen] = useState(true);
  const { data: overloads = [], isPending, isError, isFetching } = useQueueOverloadsQuery(employee);

  useEffect(() => {
    if (isError) {
      showError('Не удалось загрузить предупреждения по очереди');
    }
  }, [isError, showError]);

  useEffect(() => {
    if (overloads.length > 0) {
      setOpen(true);
    }
  }, [overloads.length]);

  if ((isPending || isFetching) && overloads.length === 0) return null;
  if (overloads.length === 0) return null;

  return (
    <Collapse in={open}>
      <Stack sx={{ mb: 2 }} spacing={1}>
        {overloads.map((item) => {
          const task = {
            folderPath: item.taskTitle,
            heading: item.taskTitle,
            fileName: item.fileName
          };

          return (
            <Alert
              key={item.taskId}
              severity="info"
              icon={<Queue fontSize="inherit" />}
              sx={{ borderRadius: 2, '& .MuiAlert-icon': { alignItems: 'center' } }}
              action={
                <IconButton size="small" onClick={() => setOpen(false)} aria-label="Скрыть предупреждения">
                  <Close fontSize="small" />
                </IconButton>
              }
            >
              <AlertTitle sx={{ fontWeight: 600, fontSize: '0.9rem', mb: 0.5 }}>
                Перегруз очереди
                {item.employeeName ? ` · ${item.employeeName}` : ''}
              </AlertTitle>

              <TaskTitleTwoLines
                task={task}
                headingVariant="body2"
                statusVariant="body2"
                headingSx={{ fontWeight: 600 }}
                statusSx={{ color: 'text.secondary', mt: 0.25 }}
              />

              <Stack
                direction="row"
                spacing={2}
                sx={{ mt: 1, fontSize: '0.8rem', color: 'text.secondary', alignItems: 'center', flexWrap: 'wrap' }}
              >
                <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                  <Schedule sx={{ fontSize: 14 }} />
                  <span>
                    План до{' '}
                    {new Date(item.plannedEnd).toLocaleString('ru-RU', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </Stack>
                <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                  <Event sx={{ fontSize: 14 }} />
                  <span>
                    Дедлайн{' '}
                    {new Date(item.deadline).toLocaleString('ru-RU', {
                      day: '2-digit',
                      month: '2-digit',
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
