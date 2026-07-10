import { alpha, Box, IconButton } from '@mui/material';
import { Close, InsertDriveFile } from '@mui/icons-material';
import { useChatComposer, useChatLocaleText } from '@mui/x-chat-headless';
import { ChatComposerAttachmentList } from '@mui/x-chat';
import ChatImagePreview from './ChatImagePreview';

function ChatComposerAttachmentsContent() {
  const composer = useChatComposer();
  const localeText = useChatLocaleText();

  if (!composer.attachments.length) return null;

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 1,
        py: 0.5
      }}
    >
      {composer.attachments.map((attachment) => {
        const fileName = attachment.file.name || localeText.composerAttachmentFallbackLabel;
        const isImage = attachment.file.type?.startsWith('image/') && attachment.previewUrl;

        if (isImage) {
          return (
            <Box
              key={attachment.localId}
              sx={{
                position: 'relative',
                display: 'inline-flex',
                flexDirection: 'column',
                gap: 0.5
              }}
            >
              <ChatImagePreview
                src={attachment.previewUrl}
                alt={fileName}
                maxPreviewHeight={120}
                maxPreviewWidth={160}
              />
              <IconButton
                size="small"
                aria-label={localeText.composerRemoveAttachmentLabel(fileName)}
                onClick={() => composer.removeAttachment(attachment.localId)}
                sx={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  width: 24,
                  height: 24,
                  bgcolor: (t) => alpha(t.palette.background.paper, 0.92),
                  boxShadow: 1,
                  '&:hover': { bgcolor: 'background.paper' }
                }}
              >
                <Close sx={{ fontSize: 16 }} />
              </IconButton>
            </Box>
          );
        }

        return (
          <Box
            key={attachment.localId}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.75,
              px: 1.25,
              py: 0.75,
              maxWidth: 220,
              borderRadius: 2,
              border: (t) => `1px solid ${t.palette.divider}`,
              bgcolor: 'background.paper',
              fontSize: '0.75rem',
              color: 'text.secondary'
            }}
          >
            <InsertDriveFile sx={{ fontSize: 20, flexShrink: 0 }} />
            <Box
              component="span"
              sx={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                minWidth: 0,
                flex: 1
              }}
            >
              {fileName}
            </Box>
            <IconButton
              size="small"
              aria-label={localeText.composerRemoveAttachmentLabel(fileName)}
              onClick={() => composer.removeAttachment(attachment.localId)}
              sx={{ width: 22, height: 22, flexShrink: 0 }}
            >
              <Close sx={{ fontSize: 14 }} />
            </IconButton>
          </Box>
        );
      })}
    </Box>
  );
}

export default function ChatComposerAttachments(props) {
  return (
    <ChatComposerAttachmentList {...props}>
      <ChatComposerAttachmentsContent />
    </ChatComposerAttachmentList>
  );
}
