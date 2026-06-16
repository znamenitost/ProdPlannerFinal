import { Box } from '@mui/material';
import { BackHandOutlined } from '@mui/icons-material';
import LazyTooltip from '../common/LazyTooltip';
import { taskShowsThroughApproval } from '../../utils/throughApproval';

/** Круглый маркер «через согласование» — почти чёрный из палитры neutral. */
export function ThroughApprovalMark({ size = 22, iconSize = 13 }) {
  return (
    <Box
      component="span"
      sx={(theme) => ({
        width: size,
        height: size,
        minWidth: size,
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '50%',
        bgcolor: theme.palette.grey[700],
        color: theme.palette.grey[50],
        verticalAlign: 'middle',
        lineHeight: 0
      })}
    >
      <BackHandOutlined sx={{ fontSize: iconSize }} />
    </Box>
  );
}

export default function ThroughApprovalChip({ task, childrenTasks = null }) {
  if (!taskShowsThroughApproval(task, childrenTasks)) return null;

  return (
    <LazyTooltip title="Через согласование" arrow>
      <Box component="span" aria-label="Через согласование">
        <ThroughApprovalMark />
      </Box>
    </LazyTooltip>
  );
}
