import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography
} from '@mui/material';
import {
  Close,
  Comment,
  Delete,
  Reply,
  Send
} from '@mui/icons-material';
import { getChatContacts, getTaskComments, addTaskComment, deleteTaskComment } from '../services/api';
import AppDialogTitle from './ui/AppDialogTitle';

function CommentItem({ comment, onReply, onDelete, deleting, hideAuthor = false }) {
  const showAuthor = !hideAuthor && Boolean(comment.authorName);
  const showRecipient = Boolean(comment.recipientName);
  const showMeta = showAuthor || showRecipient;

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
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
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

export default function CommentDialog({ open, task, pending = false, onChanged, onClose }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [value, setValue] = useState('');
  const [recipientUserId, setRecipientUserId] = useState('');
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
    setRecipientUserId('');
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
        recipientUserId: recipientUserId || null,
        replyToCommentId: replyTo?.id || null
      });
      setValue('');
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

  const handleDelete = async (comment) => {
    if (!taskId || deletingId != null) return;
    setDeletingId(comment.id);
    setError('');
    try {
      await deleteTaskComment(taskId, comment.id);
      if (replyTo?.id === comment.id) setReplyTo(null);
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
        ) : comments.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 1.5 }}>
            Пока нет записей. Добавьте первую заметку.
          </Typography>
        ) : (
          <Box sx={{ maxHeight: 320, overflowY: 'auto', mb: 1.5 }}>
            {comments.map((c, index) => (
              <CommentItem
                key={c.id}
                comment={c}
                onReply={setReplyTo}
                onDelete={handleDelete}
                deleting={deletingId === c.id}
                hideAuthor={Boolean(c.isBaseline) || index === 0}
              />
            ))}
          </Box>
        )}

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
            <IconButton size="small" onClick={() => setReplyTo(null)} aria-label="Отменить ответ">
              <Close fontSize="small" />
            </IconButton>
          </Box>
        )}

        <FormControl fullWidth size="small" sx={{ mb: 1.25 }} disabled={busy}>
          <InputLabel id="task-comment-recipient-label">Кому</InputLabel>
          <Select
            labelId="task-comment-recipient-label"
            label="Кому"
            value={recipientUserId}
            onChange={(e) => setRecipientUserId(e.target.value)}
          >
            <MenuItem value="">
              <em>Всем (админы и сотрудники)</em>
            </MenuItem>
            {contacts.map((c) => (
              <MenuItem key={c.userId} value={c.userId}>
                {c.fullName}
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
