import { Tooltip } from '@mui/material';
import { needsTooltip } from '../../utils/taskTableStyles';

const tableTooltipProps = {
  arrow: true,
  placement: 'top'
};

/** MUI tooltip for table cells when text-limit setting truncates the preview. */
export default function TableTruncatedTooltip({ fullText, limit, children }) {
  const text = String(fullText ?? '').trim();
  if (!needsTooltip(text, limit)) {
    return children;
  }

  return (
    <Tooltip title={text} {...tableTooltipProps}>
      {children}
    </Tooltip>
  );
}
