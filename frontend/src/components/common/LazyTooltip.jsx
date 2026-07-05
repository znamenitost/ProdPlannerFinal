import { isValidElement, useState } from 'react';
import { Tooltip } from '@mui/material';

function callHandler(handler, event) {
  if (typeof handler === 'function') {
    handler(event);
  }
}

const triggerWrapStyle = {
  display: 'block',
  minWidth: 0,
  maxWidth: '100%'
};

export default function LazyTooltip({ children, title, ...tooltipProps }) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  if (!title || !isValidElement(children)) {
    return children;
  }

  const openTooltip = () => {
    setMounted(true);
    setOpen(true);
  };

  const closeTooltip = () => {
    setOpen(false);
  };

  const trigger = (
    <span
      style={triggerWrapStyle}
      onMouseEnter={(event) => {
        callHandler(children.props.onMouseEnter, event);
        openTooltip();
      }}
      onFocus={(event) => {
        callHandler(children.props.onFocus, event);
        openTooltip();
      }}
      onMouseLeave={(event) => {
        callHandler(children.props.onMouseLeave, event);
        closeTooltip();
      }}
      onBlur={(event) => {
        callHandler(children.props.onBlur, event);
        closeTooltip();
      }}
    >
      {children}
    </span>
  );

  if (!mounted) {
    return trigger;
  }

  return (
    <Tooltip
      {...tooltipProps}
      title={title}
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
    >
      {trigger}
    </Tooltip>
  );
}
