import { Alert, AlertTitle, Stack } from '@mui/material';
import { Error, Queue, Schedule, Event, AccessTime } from '@mui/icons-material';
import TaskTitleTwoLines from './TaskTitleTwoLines';

const KIND_META = {
  hoursShortfall: {
    severity: 'error',
    icon: <Error fontSize="inherit" />,
    title: 'Не хватает часов до дедлайна'
  },
  queueOverflow: {
    severity: 'warning',
    icon: <Queue fontSize="inherit" />,
    title: 'Не влезает в очередь'
  }
};

function warningKey(w) {
  return `${w.kind}-${w.taskId}`;
}

export default function PlanningWarningsBanner({ warnings, onDismiss }) {
  if (!warnings?.length) return null;

  return (
    <Stack sx={{ mb: 2 }} spacing={1}>
      {warnings.map((item) => {
        const meta = KIND_META[item.kind] ?? {
          severity: 'warning',
          icon: <Queue fontSize="inherit" />,
          title: 'Планирование'
        };
        const task = {
          folderPath: item.taskTitle,
          heading: item.taskTitle,
          fileName: item.fileName
        };

        return (
          <Alert
            key={warningKey(item)}
            severity={meta.severity}
            icon={meta.icon}
            onClose={() => onDismiss(item.taskId, item.kind)}
            sx={{ borderRadius: 2, '& .MuiAlert-icon': { alignItems: 'center' } }}
          >
            <AlertTitle sx={{ fontWeight: 600, fontSize: '0.9rem', mb: 0.5 }}>
              {meta.title}
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
              sx={{
                mt: 1,
                fontSize: '0.8rem',
                color: 'text.secondary',
                alignItems: 'center',
                flexWrap: 'wrap'
              }}
            >
              {item.kind === 'hoursShortfall' && (
                <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                  <AccessTime sx={{ fontSize: 14 }} />
                  <span>
                    Нужно {Math.round(item.requiredHours * 10) / 10} ч, доступно{' '}
                    {Math.round(item.availableHours * 10) / 10} ч
                  </span>
                </Stack>
              )}
              {item.kind === 'queueOverflow' && item.plannedEnd && (
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
              )}
              {item.deadline && (
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
              )}
            </Stack>
          </Alert>
        );
      })}
    </Stack>
  );
}
