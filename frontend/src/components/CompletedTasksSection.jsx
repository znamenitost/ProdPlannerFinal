import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography
} from '@mui/material';
import { ExpandMore, Assessment } from '@mui/icons-material';
import CompletedTasksList from './CompletedTasksList';
import useAuth from '../hooks/useAuth';
import useUserPreference from '../hooks/useUserPreference';

export default function CompletedTasksSection({ employee }) {
  const { user } = useAuth();
  const [expanded, setExpanded] = useUserPreference(user, 'completedTasks.expanded', false);

  return (
    <Accordion
      expanded={expanded}
      onChange={(_, isExpanded) => setExpanded(isExpanded)}
      disableGutters
      sx={{
        borderRadius: '10px !important',
        overflow: 'hidden',
        '&:before': { display: 'none' },
        boxShadow: (theme) => theme.shadows[1]
      }}
    >
      <AccordionSummary expandIcon={<ExpandMore />} aria-controls="completed-tasks-content" id="completed-tasks-header">
        <Assessment color="primary" sx={{ mr: 1 }} />
        <Typography variant="h2" component="h2">
          Выполненные задачи
        </Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ px: 2, pb: 2, pt: 0 }}>
        <CompletedTasksList employee={employee} embedded />
      </AccordionDetails>
    </Accordion>
  );
}
