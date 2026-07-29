import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  alpha,
  Avatar,
  Badge,
  Box,
  Dialog,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
  useMediaQuery
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Chat as ChatIcon,
  Close,
  PersonAdd
} from '@mui/icons-material';
import { ChatBox } from '@mui/x-chat';
import { createProductionChatAdapter, CHAT_HISTORY_PREFETCH_PX } from './createProductionChatAdapter';
import ChatComposerAttachments from './ChatComposerAttachments';
import ChatComposerInputWithReply from './ChatComposerInputWithReply';
import ChatComposerSendButtonWithReply from './ChatComposerSendButtonWithReply';
import ChatComposerToolbarWithEmoji from './ChatComposerToolbarWithEmoji';
import ChatMessageContentWithReply from './ChatMessageContentWithReply';
import ChatConversationOnlineAvatar from './ChatConversationOnlineAvatar';
import ChatConversationHeaderSubtitle from './ChatConversationHeaderSubtitle';
import ChatScrollToEndOnOpen from './ChatScrollToEndOnOpen';
import ChatThreadPaneWithLoading from './ChatThreadPaneWithLoading';
import { LoadingState } from '../LoadingState';
import {
  ChatEditSessionContext,
  textFromChatMessage
} from './ChatEditSessionContext';
import {
  ChatReplySessionContext,
  replyPreviewFromMessage
} from './ChatReplySessionContext';
import {
  clearPendingReplyMessage,
  setPendingReplyMessage
} from './chatReplyPreview';
import { renderChatFilePart } from './renderChatFilePart';
import { avatarDisplayUrl } from '../../utils/avatarUrl';

const messageStatusLabels = {
  pending: 'Ожидание',
  sending: 'Отправка…',
  streaming: 'Печатает…',
  sent: 'Отправлено',
  read: 'Прочитано',
  error: 'Ошибка',
  cancelled: 'Отменено'
};

const ruLocaleTextBase = {
  composerInputPlaceholder: 'Сообщение…',
  composerInputAriaLabel: 'Сообщение',
  composerSendButtonLabel: 'Отправить',
  composerAttachButtonLabel: 'Прикрепить файл',
  composerAttachInputLabel: 'Выбрать файлы',
  composerAttachmentFallbackLabel: 'Файл',
  conversationListLandmarkLabel: 'Список чатов',
  conversationListNoConversationsLabel: 'Нет диалогов',
  conversationListSearchPlaceholder: 'Поиск…',
  threadNoMessagesLabel: 'Нет сообщений',
  threadNoMessagesHelperText: 'Напишите первое сообщение или прикрепите файл',
  scrollToBottomLabel: 'К новым сообщениям',
  unreadMarkerLabel: 'Новые сообщения',
  loadingLabel: 'Загрузка…',
  genericErrorLabel: 'Что-то пошло не так',
  retryButtonLabel: 'Повторить',
  messageAuthorUserLabel: 'Вы',
  messageAuthorAssistantLabel: 'Сотрудник',
  threadLandmarkLabel: 'Переписка',
  composerLandmarkLabel: 'Написать сообщение',
  conversationHeaderMenuLabel: 'Чаты',
  conversationHeaderBackLabel: 'Назад',
  conversationHeaderCloseLabel: 'Закрыть',
  messageEditedLabel: 'изм.',
  messageStatusLabel: (status) => messageStatusLabels[status] || status
};

function NewChatMenu({ contacts, onPick, disabled }) {
  const [anchor, setAnchor] = useState(null);
  return (
    <>
      <Tooltip title="Написать сотруднику">
        <span>
          <IconButton
            size="small"
            disabled={disabled || !contacts.length}
            onClick={(e) => setAnchor(e.currentTarget)}
            aria-label="Новый чат"
          >
            <PersonAdd fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {contacts.map((c) => (
          <MenuItem
            key={c.userId}
            onClick={() => {
              setAnchor(null);
              onPick(c);
            }}
          >
            <ListItemIcon>
              <Badge
                overlap="circular"
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                variant="dot"
                sx={{
                  '& .MuiBadge-badge': {
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    bgcolor: c.isOnline ? 'success.main' : 'grey.400',
                    boxShadow: (t) => `0 0 0 2px ${t.palette.background.paper}`
                  }
                }}
              >
                <Avatar
                  src={avatarDisplayUrl(c.userId, { size: 64 })}
                  sx={{ width: 28, height: 28, fontSize: '0.75rem' }}
                >
                  {(c.fullName || '?')[0]}
                </Avatar>
              </Badge>
            </ListItemIcon>
            <ListItemText
              primary={c.fullName}
              secondary={c.isOnline
                ? 'В сети'
                : (c.role === 'Admin' ? 'Администратор' : 'Сотрудник')}
            />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

export default function ChatDrawer({
  open,
  onClose,
  user,
  hubConnection,
  onUnreadMaybeChanged,
  initialConversationId,
  onActiveConversationChange
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const currentUserId = user?.id;
  const normalizedInitialConversationId = initialConversationId != null
    ? String(initialConversationId)
    : undefined;

  const [activeConversationId, setActiveConversationId] = useState(() => (
    normalizedInitialConversationId
  ));
  const [contacts, setContacts] = useState([]);
  const [editingMessage, setEditingMessage] = useState(null);
  const [replyingMessage, setReplyingMessage] = useState(null);
  const editingMessageRef = useRef(null);
  const replyingMessageRef = useRef(null);
  const onUnreadMaybeChangedRef = useRef(onUnreadMaybeChanged);
  const pickedDefaultConversationRef = useRef(false);
  editingMessageRef.current = editingMessage;
  replyingMessageRef.current = replyingMessage;
  onUnreadMaybeChangedRef.current = onUnreadMaybeChanged;

  const currentUser = useMemo(() => {
    if (!user?.id) return undefined;
    return {
      id: user.id,
      displayName: user.fullName,
      avatarUrl: avatarDisplayUrl(user.id, { size: 96 }),
      role: 'user'
    };
  }, [user?.id, user?.fullName]);

  const adapter = useMemo(() => {
    if (!currentUserId) return null;
    return createProductionChatAdapter({
      currentUserId,
      onUnreadMaybeChanged: () => onUnreadMaybeChangedRef.current?.(),
      getEditingMessage: () => editingMessageRef.current,
      clearEditingMessage: () => {
        editingMessageRef.current = null;
        setEditingMessage(null);
      },
      getReplyingMessage: () => replyingMessageRef.current,
      clearReplyingMessage: () => {
        clearPendingReplyMessage(replyingMessageRef.current?.id);
        replyingMessageRef.current = null;
        setReplyingMessage(null);
      }
    });
  }, [currentUserId]);

  const editSession = useMemo(() => ({
    editing: editingMessage,
    startEdit: (message) => {
      if (!message || message.role !== 'user') return;
      replyingMessageRef.current = null;
      setReplyingMessage(null);
      const next = {
        id: String(message.id),
        conversationId: String(activeConversationId || message.conversationId || ''),
        text: textFromChatMessage(message)
      };
      editingMessageRef.current = next;
      setEditingMessage(next);
    },
    cancelEdit: () => {
      editingMessageRef.current = null;
      setEditingMessage(null);
    }
  }), [editingMessage, activeConversationId]);

  const replySession = useMemo(() => ({
    replying: replyingMessage,
    startReply: (message) => {
      if (!message?.id || message.role === 'user') return;
      editingMessageRef.current = null;
      setEditingMessage(null);
      const next = {
        id: String(message.id),
        conversationId: String(activeConversationId || message.conversationId || ''),
        senderUserId: message.author?.id || '',
        senderFullName: message.author?.displayName
          || (message.role === 'user' ? 'Вы' : 'Сообщение'),
        preview: replyPreviewFromMessage(message)
      };
      replyingMessageRef.current = next;
      setPendingReplyMessage(next);
      setReplyingMessage(next);
    },
    cancelReply: () => {
      clearPendingReplyMessage(replyingMessageRef.current?.id);
      replyingMessageRef.current = null;
      setReplyingMessage(null);
    }
  }), [replyingMessage, activeConversationId]);

  const ruLocaleText = useMemo(() => ({
    ...ruLocaleTextBase,
    composerSendButtonLabel: editingMessage ? 'Сохранить' : 'Отправить',
    composerInputPlaceholder: editingMessage ? 'Изменить сообщение…' : 'Сообщение…'
  }), [editingMessage]);

  const handleConversationsChange = useCallback((conversations) => {
    if (normalizedInitialConversationId || pickedDefaultConversationRef.current) return;
    const team = conversations.find((c) => c.metadata?.type === 'Team') || conversations[0];
    if (!team?.id) return;
    const nextId = String(team.id);
    pickedDefaultConversationRef.current = true;
    setActiveConversationId((prev) => (prev === nextId ? prev : nextId));
  }, [normalizedInitialConversationId]);

  useEffect(() => {
    if (!open) {
      pickedDefaultConversationRef.current = false;
      setActiveConversationId(undefined);
    }
  }, [open]);

  useEffect(() => {
    if (!adapter) return undefined;
    adapter.bindHub(hubConnection);
    return () => adapter.unbindHub();
  }, [adapter, hubConnection]);

  useEffect(() => {
    // Leaving a thread cancels in-progress edit or reply.
    editingMessageRef.current = null;
    setEditingMessage(null);
    replyingMessageRef.current = null;
    clearPendingReplyMessage();
    setReplyingMessage(null);
  }, [activeConversationId]);

  useEffect(() => {
    if (!adapter) return;
    adapter.setViewingState({
      open,
      conversationId: open ? (activeConversationId ?? null) : null
    });
  }, [adapter, open, activeConversationId]);

  useEffect(() => {
    if (!open || !adapter) return undefined;
    let cancelled = false;
    adapter.listContacts()
      .then((list) => {
        if (!cancelled) setContacts(list);
      })
      .catch(() => {
        if (!cancelled) setContacts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, adapter]);

  // Live online/offline dots in the "new chat" contact menu.
  useEffect(() => {
    if (!open || !hubConnection) return undefined;
    const onPresence = (userId, isOnline) => {
      setContacts((prev) => {
        if (!prev.some((c) => c.userId === userId)) return prev;
        return prev.map((c) => (
          c.userId === userId ? { ...c, isOnline: Boolean(isOnline) } : c
        ));
      });
    };
    hubConnection.on('ChatPresence', onPresence);
    return () => {
      hubConnection.off('ChatPresence', onPresence);
    };
  }, [open, hubConnection]);

  useEffect(() => {
    if (!open || !normalizedInitialConversationId) return;
    setActiveConversationId((prev) => {
      const next = normalizedInitialConversationId;
      return prev === next ? prev : next;
    });
  }, [open, normalizedInitialConversationId]);

  useEffect(() => {
    if (!open || !activeConversationId) return;
    onActiveConversationChange?.(activeConversationId);
  }, [open, activeConversationId, onActiveConversationChange]);

  const handleActiveConversationChange = (id) => {
    if (id == null) return;
    const next = String(id);
    if (!next) return;
    setActiveConversationId((prev) => (prev === next ? prev : next));
  };

  const handleOpenDirect = async (contact) => {
    if (!adapter) return;
    try {
      const conversation = await adapter.openDirect(contact.userId);
      setActiveConversationId(conversation.id);
    } catch (err) {
      console.warn('Open direct chat failed:', err?.message ?? err);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth={false}
      slotProps={{
        backdrop: {
          sx: { bgcolor: alpha('#1a2030', 0.45) }
        },
        paper: {
          elevation: 0,
          sx: {
            width: { xs: '100%', sm: 960, md: 1040 },
            maxWidth: { xs: 'calc(100vw - 32px)', sm: 'calc(100vw - 64px)' },
            minWidth: { sm: 720 },
            height: { xs: '78vh', sm: 620, md: 660 },
            maxHeight: { xs: '78vh', sm: 'min(660px, calc(100vh - 96px))' },
            m: { xs: 2, sm: 4 },
            borderRadius: { xs: 2, sm: 3 },
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            border: (t) => `1px solid ${t.palette.divider}`,
            boxShadow: (t) => `0 24px 64px ${alpha(t.palette.grey[700], 0.22)}`
          }
        }
      }}
    >
      <Box
        sx={{
          px: 2.5,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          borderBottom: (t) => `1px solid ${t.palette.divider}`,
          bgcolor: 'background.paper',
          flexShrink: 0
        }}
      >
        <Avatar
          variant="rounded"
          sx={{
            width: 36,
            height: 36,
            bgcolor: (t) => alpha(t.palette.primary.main, 0.14),
            color: 'primary.dark',
            borderRadius: 2
          }}
        >
          <ChatIcon fontSize="small" />
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
            Сообщения
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Общий чат и личные переписки
          </Typography>
        </Box>
        <NewChatMenu
          contacts={contacts}
          onPick={handleOpenDirect}
          disabled={!adapter}
        />
        <IconButton size="small" onClick={onClose} aria-label="Закрыть чат">
          <Close fontSize="small" />
        </IconButton>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, display: 'flex' }}>
        {open && adapter && currentUser ? (
          <ChatEditSessionContext.Provider value={editSession}>
            <ChatReplySessionContext.Provider value={replySession}>
            <ChatBox
              key={currentUserId}
              adapter={adapter}
              currentUser={currentUser}
              activeConversationId={activeConversationId}
              onActiveConversationChange={handleActiveConversationChange}
              onConversationsChange={handleConversationsChange}
              variant="default"
              density="comfortable"
              localeText={ruLocaleText}
              layoutMode={isMobile ? 'split' : 'standard'}
              partRenderers={{ file: renderChatFilePart }}
              slots={{
                threadPane: ChatThreadPaneWithLoading,
                conversationSubtitle: ChatConversationHeaderSubtitle,
                composerAttachmentList: ChatComposerAttachments,
                composerInput: ChatComposerInputWithReply,
                composerToolbar: ChatComposerToolbarWithEmoji,
                composerSendButton: ChatComposerSendButtonWithReply,
                composerAttachButton: editingMessage ? null : undefined,
                messageActions: null,
                messageContent: ChatMessageContentWithReply
              }}
              slotProps={{
                messageList: {
                  estimatedItemSize: CHAT_HISTORY_PREFETCH_PX
                },
                conversationList: {
                  slots: {
                    itemAvatar: ChatConversationOnlineAvatar
                  }
                }
              }}
              features={{
                conversationList: true,
                attachments: editingMessage
                  ? false
                  : {
                    maxFileCount: 5,
                    maxFileSize: 10 * 1024 * 1024
                    // No acceptedMimeTypes — any file type is allowed.
                  },
                dateDivider: true,
                unreadMarker: true,
                scrollToBottom: true,
                autoScroll: true,
                suggestions: false,
                streamingIndicator: false,
                helperText: false
              }}
              sx={{
                height: '100%',
                width: '100%',
                minWidth: 0,
                flex: 1,
                border: 'none',
                borderRadius: 0,
                '--ChatBox-conversationListWidth': '300px',
                bgcolor: 'background.default',
                '@keyframes chatMessageHighlight': {
                  '0%': { backgroundColor: 'transparent' },
                  '25%': { backgroundColor: (t) => alpha(t.palette.primary.main, 0.14) },
                  '100%': { backgroundColor: 'transparent' }
                },
                '& [role="article"][data-chat-highlight="true"]': {
                  animation: 'chatMessageHighlight 1.1s ease-out'
                },
                '& .MuiChatMessage-bubble': {
                  overflow: 'visible'
                },
                '& .MuiChatMessage-inlineMetaStatus .MuiSvgIcon-root': {
                  fontSize: '1.05em'
                },
                '& .MuiChatMessage-bubble[data-role="user"] .MuiChatMessage-inlineMetaStatus': {
                  color: 'rgba(255,255,255,0.85)'
                },
                '& .MuiChatBox-root': {
                  height: '100%',
                  width: '100%'
                },
                '& .MuiChatBox-layout': {
                  minHeight: 0,
                  height: '100%',
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'row'
                },
                '& .MuiChatBox-conversationsPane': {
                  borderRight: (t) => `1px solid ${t.palette.divider}`,
                  bgcolor: 'background.paper',
                  flexShrink: 0
                },
                '& .MuiChatBox-threadPane': {
                  bgcolor: 'transparent',
                  flex: '1 1 auto',
                  minWidth: 0,
                  width: 'auto'
                }
              }}
            >
              <ChatScrollToEndOnOpen />
            </ChatBox>
            </ChatReplySessionContext.Provider>
          </ChatEditSessionContext.Provider>
        ) : (
          <LoadingState message="Загрузка чата…" />
        )}
      </Box>
    </Dialog>
  );
}
