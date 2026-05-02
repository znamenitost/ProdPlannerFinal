import { useState, useEffect } from 'react';
import { Alert, AlertTitle, Stack, Collapse, IconButton } from '@mui/material';
import { Warning, Error, Close, Schedule, AccessTime, Flag, Event } from '@mui/icons-material';

export default function DeadlineWarnings({ employee, refresh }) {
  const [risks, setRisks] = useState([]);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const fetchRisks = async () => {
      try {
        const res = await fetch(`/api/tasks/deadline-risks?employee=${encodeURIComponent(employee)}`);
        const data = await res.json();
        setRisks(data.filter(r => r.riskLevel !== 'ok'));
      } catch (err) {
        console.error('Ошибка загрузки рисков:', err);
      }
    };
    fetchRisks();
  }, [employee, refresh]);

  if (risks.length === 0) return null;

  return (
    <Collapse in={open}>
      <Stack sx={{ mb: 3 }} spacing={1}>
        {risks.map(risk => {
          let severity = 'warning';
          let icon = <Warning sx={{ color: '#f39c12' }} />;
          let title = 'Дедлайн приближается';
          
          if (risk.riskLevel === 'overdue') {
            severity = 'error';
            icon = <Flag sx={{ color: '#e74c3c' }} />;
            title = 'Дедлайн сорван';
          } else if (risk.riskLevel === 'critical') {
            severity = 'error';
            icon = <Error sx={{ color: '#e74c3c' }} />;
            title = 'Критично';
          }
          
          let shortMessage = '';
          if (risk.riskLevel === 'overdue') {
            shortMessage = 'Задача просрочена';
          } else if (risk.riskLevel === 'critical') {
            shortMessage = `Не хватает ${Math.round(risk.requiredHours - risk.availableHoursBeforeDeadline)} ч`;
          } else {
            shortMessage = `Осталось ${Math.round(risk.availableHoursBeforeDeadline)} из ${Math.round(risk.requiredHours)} ч`;
          }
          
          const shortTitle = risk.taskTitle.split('\\').pop().split('/').pop();
          
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
              
              <strong>{shortTitle}</strong>
              
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
                  <span>{new Date(risk.deadline).toLocaleDateString()} {new Date(risk.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </Stack>
              </Stack>
            </Alert>
          );
        })}
      </Stack>
    </Collapse>
  );
}