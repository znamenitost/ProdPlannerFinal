import { useState, useEffect } from 'react';
import { Alert, AlertTitle, Stack, Collapse, IconButton } from '@mui/material';
import { Warning, Error, Close, Schedule, AccessTime, Flag, Event } from '@mui/icons-material';

export default function DeadlineWarnings({ employee, refresh }) {
  const [risks, setRisks] = useState([]);
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchRisks = async () => {
      if (!employee) return;
      
      setLoading(true);
      try {
        const res = await fetch(`/api/tasks/deadline-risks?employee=${encodeURIComponent(employee)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        // Фильтруем только риски (не 'ok')
        const risksData = Array.isArray(data) ? data.filter(r => r.riskLevel !== 'ok') : [];
        setRisks(risksData);
        
        // Если появились новые риски, раскрываем предупреждения
        if (risksData.length > 0 && risks.length === 0) {
          setOpen(true);
        }
      } catch (err) {
        console.error('Ошибка загрузки рисков:', err);
        setRisks([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchRisks();
  }, [employee, refresh]); // refresh вызывает перезагрузку

  if (loading && risks.length === 0) return null;
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
            const deficit = risk.requiredHours - risk.availableHoursBeforeDeadline;
            shortMessage = `Не хватает ${Math.round(deficit)} ч`;
          } else {
            shortMessage = `Осталось ${Math.round(risk.availableHoursBeforeDeadline)} из ${Math.round(risk.requiredHours)} ч`;
          }
          
          const shortTitle = (risk.taskTitle || 'Без названия').split('\\').pop().split('/').pop();
          
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
                  <span>
                    {new Date(risk.deadline).toLocaleDateString()} {' '}
                    {new Date(risk.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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