import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  ListItemText,
  MenuItem,
  Select,
  TextField,
  Typography
} from '@mui/material';
import {
  Close,
  Comment,
  Delete,
  Notes,
  Reply,
  Send
} from '@mui/icons-material';
import { getChatContacts, getTaskComments, addTaskComment, deleteTaskComment } from '../services/api';
import AppDialogTitle from './ui/AppDialogTitle';

function CommentItem({ comment, onReply, onDelete, deleting, hideAuthor = false }) {
  const showAuthor = !hideAuthor && Boolean(comment.authorName);
  const showRecipient = Boolean(comment.recipientName);
  const isPrimaryNote = hideAuthor && !showAuthor && !showRecipient;
  const showMeta = showAuthor || showRecipient || isPrimaryNote;

  return (
    <Box
      sx={{
        py: 1,
        px: 1.25,
        borderRadius: 1,
        bgcolor: 'action.hover',
        '& + &': { mt: 1 }
      }}
    >
      {comment.replyTo && (
        <Box
          sx={{
            mb: 0.75,
            pl: 1,
            borderLeft: 2,
            borderColor: 'primary.main',
            opacity: 0.85
          }}
        >
          {comment.replyTo.authorName ? (
            <Typography variant="caption" sx={{ fontWeight: 700, display: 'block' }}>
              {comment.replyTo.authorName}
            </Typography>
          ) : null}
          <Typography variant="caption" color="text.secondary" noWrap>
            {comment.replyTo.preview}
          </Typography>
        </Box>
      )}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {showMeta ? (
            <Typography
              variant="body2"
              sx={{
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                flexWrap: 'wrap'
              }}
            >
              {isPrimaryNote ? (
                <Notes sx={{ fontSize: 16, color: 'text.secondary' }} aria-hidden />
              ) : null}
              {showAuthor ? comment.authorName : null}
              {showRecipient ? (
                <Typography component="span" variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                  {showAuthor ? ' → ' : '→ '}
                  {comment.recipientName}
                </Typography>
              ) : null}
            </Typography>
          ) : null}
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {comment.text}
          </Typography>
        </Box>
        <IconButton
          size="small"
          aria-label="Ответить"
          onClick={() => onReply(comment)}
          sx={{ mt: -0.25 }}
        >
          <Reply fontSize="small" />
        </IconButton>
        {comment.canDelete && (
          <IconButton
            size="small"
            aria-label="Удалить"
            onClick={() => onDelete(comment)}
            disabled={deleting}
            sx={{ mt: -0.25 }}
          >
            <Delete fontSize="small" />
          </IconButton>
        )}
      </Box>
    </Box>
  );
}

const RECIPIENT_ALL = '__all__';
const RECIPIENT_NONE = '__none__';

function recipientSelectLabel(selectedIds, contacts) {
  if (!selectedIds.length) return 'Никому';
  if (contacts.length > 0 && selectedIds.length === contacts.length) return 'Всем';
  const names = selectedIds
    .map((id) => contacts.find((c) => c.userId === id)?.fullName || id)
    .filter(Boolean);
  return names.join(', ');
}

export default function CommentDialog({ open, task, pending = false, onChanged, onClose }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [value, setValue] = useState('');
  const [recipientUserIds, setRecipientUserIds] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [replyTo, setReplyTo] = useState(null);
  const [sending, setSending] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState('');
  const onChangedRef = useRef(onChanged);
  onChangedRef.current = onChanged;

  const taskId = task?.id;

  const loadComments = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    setError('');
    try {
      const data = await getTaskComments(taskId);
      setComments(data?.comments || []);
      onChangedRef.current?.(taskId);
    } catch (err) {
      console.error(err);
      setError('Не удалось загрузить комментарии');
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    if (!open) return undefined;
    setValue('');
    setRecipientUserIds([]);
    setReplyTo(null);
    setError('');
    loadComments();

    let cancelled = false;
    getChatContacts()
      .then((list) => {
        if (!cancelled) setContacts(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) setContacts([]);
      });

    return () => {
      cancelled = true;
    };
  }, [open, loadComments]);

  const handleSend = async () => {
    if (!taskId || sending || pending) return;
    const text = value.trim();
    if (!text) return;

    setSending(true);
    setError('');
    try {
      await addTaskComment(taskId, {
        text,
        recipientUserIds: recipientUserIds.length > 0 ? recipientUserIds : null,
        replyToCommentId: replyTo?.id || null
      });
      setValue('');
      setRecipientUserIds([]);
      setReplyTo(null);
      await loadComments();
      onChanged?.(taskId);
    } catch (err) {
      console.error(err);
      setError(err?.message || 'Не удалось добавить комментарий');
    } finally {
      setSending(false);
    }
  };

  const handleReply = (comment) => {
    setReplyTo(comment);
    const authorId = String(comment?.authorUserId || '').trim();
    setRecipientUserIds(authorId ? [authorId] : []);
  };

  const clearReply = () => {
    setReplyTo(null);
    setRecipientUserIds([]);
  };

  const handleDelete = async (comment) => {
    if (!taskId || deletingId != null) return;
    setDeletingId(comment.id);
    setError('');
    try {
      await deleteTaskComment(taskId, comment.id);
      if (replyTo?.id === comment.id) clearReply();
      await loadComments();
      onChanged?.(taskId);
    } catch (err) {
      console.error(err);
      setError(err?.message || 'Не удалось удалить комментарий');
    } finally {
      setDeletingId(null);
    }
  };

  const busy = pending || sending || deletingId != null;
  const allRecipientIds = contacts.map((c) => c.userId);
  const allRecipientsSelected =
    allRecipientIds.length > 0 &&
    allRecipientIds.every((id) => recipientUserIds.includes(id));

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <AppDialogTitle
        onClose={onClose}
        closeDisabled={busy}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
          <Comment color="primary" fontSize="small" />
          Комментарии
        </Box>
      </AppDialogTitle>
      <Divider />
      <DialogContent sx={{ px: { xs: 2, sm: 3 }, py: 2.5 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={28} />
          </Box>
        ) : comments.length === 0 && !error ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 1.5 }}>
            Пока нет записей. Добавьте первую заметку.
          </Typography>
        ) : comments.length > 0 ? (
          <Box sx={{ maxHeight: 320, overflowY: 'auto', mb: 1.5 }}>
            {comments.map((c, index) => (
              <CommentItem
                key={c.id}
                comment={c}
                onReply={handleReply}
                onDelete={handleDelete}
                deleting={deletingId === c.id}
                hideAuthor={Boolean(c.isBaseline) || index === 0}
              />
            ))}
          </Box>
        ) : null}

        {replyTo && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              mb: 1,
              px: 1,
              py: 0.75,
              borderRadius: 1,
              bgcolor: 'action.selected'
            }}
          >
            <Reply fontSize="small" color="primary" />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="caption" sx={{ fontWeight: 700 }}>
                {replyTo.isBaseline || !replyTo.authorName
                  ? 'Ответ'
                  : `Ответ для ${replyTo.authorName}`}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap display="block">
                {replyTo.text}
              </Typography>
            </Box>
            <IconButton size="small" onClick={clearReply} aria-label="Отменить ответ">
              <Close fontSize="small" />
            </IconButton>
          </Box>
        )}

        <FormControl fullWidth size="small" sx={{ mb: 1.25 }} disabled={busy}>
          <InputLabel id="task-comment-recipient-label">
            Кому отправить оповещение
          </InputLabel>
          <Select
            labelId="task-comment-recipient-label"
            label="Кому отправить оповещение"
            multiple
            value={recipientUserIds}
            onChange={(e) => {
              const next = e.target.value;
              const values = typeof next === 'string' ? next.split(',') : next;
              if (values.includes(RECIPIENT_NONE)) {
                setRecipientUserIds([]);
                return;
              }
              if (values.includes(RECIPIENT_ALL)) {
                setRecipientUserIds(allRecipientsSelected ? [] : allRecipientIds);
                return;
              }
              setRecipientUserIds(
                values.filter((id) => id !== RECIPIENT_ALL && id !== RECIPIENT_NONE)
              );
            }}
            renderValue={(selected) => recipientSelectLabel(selected, contacts)}
          >
            <MenuItem value={RECIPIENT_NONE}>
              <Checkbox checked={recipientUserIds.length === 0} size="small" />
              <ListItemText primary="Никому" />
            </MenuItem>
            <MenuItem value={RECIPIENT_ALL} disabled={contacts.length === 0}>
              <Checkbox
                checked={allRecipientsSelected}
                indeterminate={
                  recipientUserIds.length > 0 && !allRecipientsSelected
                }
                size="small"
              />
              <ListItemText primary="Всем" />
            </MenuItem>
            {contacts.map((c) => (
              <MenuItem key={c.userId} value={c.userId}>
                <Checkbox checked={recipientUserIds.includes(c.userId)} size="small" />
                <ListItemText primary={c.fullName} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          autoFocus
          margin="dense"
          label="Новая заметка"
          fullWidth
          multiline
          minRows={2}
          maxRows={6}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={busy}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleSend();
            }
          }}
        />

        {error ? (
          <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
            {error}
          </Typography>
        ) : null}
      </DialogContent>
      <DialogActions sx={{ px: { xs: 2, sm: 3 }, pb: 2 }}>
        <Button
          onClick={handleSend}
          variant="contained"
          startIcon={<Send />}
          disabled={busy || !value.trim()}
        >
          Добавить
        </Button>
      </DialogActions>
    </Dialog>
  );
}
