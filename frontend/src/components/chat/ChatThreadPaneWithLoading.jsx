import { Box } from '@mui/material';
import ChatThreadLoadingOverlay from './ChatThreadLoadingOverlay';

/**
 * Thread pane wrapper: keeps MUI layout props and adds a loading overlay
 * scoped to the message area (not the conversation list).
 */
export default function ChatThreadPaneWithLoading(props) {
  const {
    children,
    className,
    style,
    ...rest
  } = props;

  return (
    <Box
      component="div"
      className={className}
      style={style}
      {...rest}
      sx={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minWidth: 0,
        overflow: 'hidden'
      }}
    >
      {children}
      <ChatThreadLoadingOverlay />
    </Box>
  );
}
