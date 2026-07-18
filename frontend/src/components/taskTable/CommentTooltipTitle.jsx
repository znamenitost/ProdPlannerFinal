import { Box, Divider, Typography } from '@mui/material';
import { ArrowForward, Person } from '@mui/icons-material';
import { parseCommentPreviewLines } from '../../utils/commentPreview';

const iconSx = { fontSize: 14, opacity: 0.92, flexShrink: 0, mt: '1px' };

function PersonLabel({ name, bold = false }) {
  if (!name) return null;
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.35, flexShrink: 0 }}>
      <Person sx={iconSx} />
      <Typography
        component="span"
        variant="caption"
        sx={{ fontWeight: bold ? 800 : 700, lineHeight: 1.35 }}
      >
        {name}
      </Typography>
    </Box>
  );
}

export default function CommentTooltipTitle({ preview }) {
  const lines = parseCommentPreviewLines(preview);
  if (lines.length === 0) return null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', py: 0.25, maxWidth: 380 }}>
      {lines.map((line, index) => {
        const isFirst = index === 0;
        const showAuthor = Boolean(line.author) && !line.hideAuthor;
        const showRecipient = Boolean(line.recipient);
        const hasMeta = showAuthor || showRecipient;

        return (
          <Box key={index}>
            {index > 0 ? (
              <Divider sx={{ my: 0.75, borderColor: 'rgba(255, 255, 255, 0.28)' }} />
            ) : null}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                columnGap: 0.5,
                rowGap: 0.25
              }}
            >
              {showAuthor ? <PersonLabel name={line.author} bold={isFirst} /> : null}
              {showRecipient ? (
                <>
                  <ArrowForward sx={iconSx} />
                  <PersonLabel name={line.recipient} bold={isFirst} />
                </>
              ) : null}
              {line.text ? (
                <Typography
                  component="span"
                  variant="caption"
                  sx={{
                    lineHeight: 1.35,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontWeight: isFirst ? 800 : 400
                  }}
                >
                  {hasMeta ? `: ${line.text}` : line.text}
                </Typography>
              ) : null}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
