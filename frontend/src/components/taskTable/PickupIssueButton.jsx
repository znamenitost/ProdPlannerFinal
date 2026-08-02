import { Button, Chip, CircularProgress } from '@mui/material';
import { CheckCircle } from '@mui/icons-material';
import { STATUS_COMPLETED } from '../../constants/taskStatuses';

/**
 * Ячейка «Выдача» в режиме выдачи: готовый заказ — кнопка «Выдать»,
 * выданный — «Выдано», остальные — отключённая кнопка с текущим статусом
 * (исключительная выдача неготового остаётся в диалоге по коду).
 */
export default function PickupIssueButton({ task, issuing = false, onIssue }) {
  if (task?.pickedUpAt) {
    return (
      <Chip
        icon={<CheckCircle sx={{ fontSize: 16 }} />}
        label="Выдано"
        size="small"
        color="success"
        variant="filled"
        sx={{ fontSize: '0.7rem', height: 24, minWidth: 88, fontWeight: 600 }}
      />
    );
  }

  if (task?.statusText !== STATUS_COMPLETED) {
    return (
      <Button
        size="small"
        variant="outlined"
        disabled
        sx={{ minWidth: 88, fontSize: '0.7rem', textTransform: 'none' }}
      >
        {task?.statusText || 'Назначена'}
      </Button>
    );
  }

  return (
    <Button
      size="small"
      variant="contained"
      color="error"
      disabled={issuing}
      onClick={() => onIssue?.(task)}
      data-pickup-issue-button={task?.id}
      sx={{ minWidth: 88, fontSize: '0.75rem', textTransform: 'none', fontWeight: 700 }}
    >
      {issuing ? <CircularProgress size={16} color="inherit" /> : 'Выдать'}
    </Button>
  );
}
