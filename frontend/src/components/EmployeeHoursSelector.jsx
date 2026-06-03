import { Box, Checkbox, FormControlLabel, Typography, Button, Grid } from '@mui/material';
import EstimateHoursInput from './EstimateHoursInput';
import { CheckCircle } from '@mui/icons-material';
import { useState, useEffect } from 'react';

export default function EmployeeHoursSelector({ employees, totalHours, onChange, initialAssignments = [] }) {
  const [assignments, setAssignments] = useState(() => {
    if (initialAssignments.length > 0) return initialAssignments;
    return [];
  });

  useEffect(() => {
    // синхронизация с внешними изменениями (например, при смене totalHours)
    const totalAssigned = assignments.reduce((sum, a) => sum + a.hours, 0);
    if (Math.abs(totalAssigned - totalHours) > 0.01 && assignments.length > 0) {
      // не сбрасываем, просто будет предупреждение
    }
  }, [totalHours, assignments]);

  const updateAssignment = (employeeName, hours) => {
    let newAssignments;
    const existing = assignments.find(a => a.employeeName === employeeName);
    if (existing) {
      newAssignments = assignments.map(a =>
        a.employeeName === employeeName ? { ...a, hours: parseFloat(hours) || 0 } : a
      );
    } else {
      newAssignments = [...assignments, { employeeName, hours: parseFloat(hours) || 0 }];
    }
    setAssignments(newAssignments);
    onChange(newAssignments);
  };

  const removeAssignment = (employeeName) => {
    const newAssignments = assignments.filter(a => a.employeeName !== employeeName);
    setAssignments(newAssignments);
    onChange(newAssignments);
  };

  const totalAssigned = assignments.reduce((sum, a) => sum + a.hours, 0);
  const remaining = totalHours - totalAssigned;

  const distributeEqually = () => {
    if (assignments.length === 0) return;
    const equalHours = totalHours / assignments.length;
    const newAssignments = assignments.map(a => ({ ...a, hours: equalHours }));
    setAssignments(newAssignments);
    onChange(newAssignments);
  };

  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom>Назначить сотрудников</Typography>
      <Grid container spacing={1}>
        {employees.map(emp => {
          const assigned = assignments.find(a => a.employeeName === emp);
          const checked = !!assigned;
          return (
            <Grid size={12} key={emp}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          updateAssignment(emp, 0);
                        } else {
                          removeAssignment(emp);
                        }
                      }}
                    />
                  }
                  label={emp}
                  sx={{ width: 120 }}
                />
                {checked && (
                  <EstimateHoursInput
                    value={assigned.hours}
                    onChange={(hours) => updateAssignment(emp, hours)}
                    max={totalHours}
                    sx={{ width: 100 }}
                  />
                )}
              </Box>
            </Grid>
          );
        })}
      </Grid>
      {assignments.length > 0 && (
        <Box sx={{ mt: 1 }}>
          <Button size="small" onClick={distributeEqually} variant="outlined" sx={{ mr: 2 }}>
            Разделить поровну
          </Button>
          <Typography variant="caption" color={remaining < -0.01 ? 'error' : 'text.secondary'} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
            Распределено: {totalAssigned.toFixed(1)} / {totalHours} ч.{' '}
            {remaining > 0.01
              ? `Осталось: ${remaining.toFixed(1)} ч`
              : remaining < -0.01
                ? `Перебор: ${(-remaining).toFixed(1)} ч`
                : <CheckCircle sx={{ fontSize: 14, color: 'success.main' }} />}
          </Typography>
        </Box>
      )}
    </Box>
  );
}