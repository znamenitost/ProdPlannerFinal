using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using ProductionPlanner.Data;
using ProductionPlanner.Hubs;
using ProductionPlanner.Models;
using ProductionPlanner.Models.Dtos;

namespace ProductionPlanner.Services;

public interface IChatService
{
    Task<IReadOnlyList<ChatContactDto>> GetContactsAsync(string currentUserId, CancellationToken ct = default);
    Task<IReadOnlyList<ChatConversationDto>> GetConversationsAsync(string currentUserId, CancellationToken ct = default);
    Task<ChatConversationDto> GetOrCreateTeamAsync(string currentUserId, CancellationToken ct = default);
    Task<ChatConversationDto> GetOrCreateDirectAsync(string currentUserId, string peerUserId, CancellationToken ct = default);
    Task<IReadOnlyList<ChatMessageDto>> GetMessagesAsync(
        string currentUserId,
        long conversationId,
        long? beforeId,
        int take,
        CancellationToken ct = default);
    Task<ChatMessageDto> SendMessageAsync(
        string currentUserId,
        long conversationId,
        string? text,
        IReadOnlyList<IFormFile>? files,
        long? replyToMessageId = null,
        CancellationToken ct = default);
    Task<ChatMessageDto> EditMessageAsync(
        string currentUserId,
        long conversationId,
        long messageId,
        string? text,
        CancellationToken ct = default);
    Task MarkReadAsync(string currentUserId, long conversationId, long lastMessageId, CancellationToken ct = default);
    Task EnsureCanAccessAsync(string currentUserId, long conversationId, CancellationToken ct = default);
    Task<(Stream Stream, string ContentType, string FileName)?> OpenAttachmentAsync(
        string currentUserId,
        long attachmentId,
        CancellationToken ct = default);
}

public sealed class ChatService : IChatService
{
    public const int MaxMessageLength = 4000;
    public const int DefaultPageSize = 50;
    public const int MaxPageSize = 100;
    public const int MaxAttachmentsPerMessage = 5;
    public const long MaxAttachmentBytes = 10 * 1024 * 1024;

    private readonly ApplicationDbContext _db;
    private readonly UserManager<User> _userManager;
    private readonly IAppTimeService _time;
    private readonly IHubContext<NotificationHub> _hub;
    private readonly NotificationConnectionRegistry _connections;
    private readonly IWebHostEnvironment _env;
    private readonly IWebPushService _webPush;

    public ChatService(
        ApplicationDbContext db,
        UserManager<User> userManager,
        IAppTimeService time,
        IHubContext<NotificationHub> hub,
        NotificationConnectionRegistry connections,
        IWebHostEnvironment env,
        IWebPushService webPush)
    {
        _db = db;
        _userManager = userManager;
        _time = time;
        _hub = hub;
        _connections = connections;
        _env = env;
        _webPush = webPush;
    }

    public async Task<IReadOnlyList<ChatContactDto>> GetContactsAsync(string currentUserId, CancellationToken ct = default)
    {
        var users = await _userManager.Users
            .AsNoTracking()
            .Where(u => u.IsActive && u.Id != currentUserId)
            .OrderBy(u => u.FullName)
            .Select(u => new { u.Id, u.FullName, u.AvatarUrl, u.Role })
            .ToListAsync(ct);

        return users
            .Select(u => new ChatContactDto
            {
                UserId = u.Id,
                FullName = u.FullName,
                AvatarUrl = u.AvatarUrl,
                Role = u.Role,
                IsOnline = _connections.CountForUser(u.Id) > 0
            })
            .ToList();
    }

    public async Task<IReadOnlyList<ChatConversationDto>> GetConversationsAsync(
        string currentUserId,
        CancellationToken ct = default)
    {
        var team = await GetOrCreateTeamAsync(currentUserId, ct);
        var directs = await _db.ChatConversations
            .AsNoTracking()
            .Where(c =>
                c.Type == ChatConversationType.Direct
                && (c.UserIdLow == currentUserId || c.UserIdHigh == currentUserId))
            .OrderByDescending(c => c.Id)
            .ToListAsync(ct);

        var result = new List<ChatConversationDto> { team };
        foreach (var conv in directs)
            result.Add(await MapConversationAsync(conv, currentUserId, ct));

        return result
            .OrderByDescending(c => c.Type == "Team")
            .ThenByDescending(c => c.LastMessage?.CreatedAt ?? DateTime.MinValue)
            .ToList();
    }

    public async Task<ChatConversationDto> GetOrCreateTeamAsync(string currentUserId, CancellationToken ct = default)
    {
        var team = await _db.ChatConversations
            .FirstOrDefaultAsync(c => c.Type == ChatConversationType.Team, ct);

        if (team == null)
        {
            team = new ChatConversation
            {
                Type = ChatConversationType.Team,
                CreatedAt = _time.Now
            };
            _db.ChatConversations.Add(team);
            try
            {
                await _db.SaveChangesAsync(ct);
            }
            catch (DbUpdateException)
            {
                _db.Entry(team).State = EntityState.Detached;
                team = await _db.ChatConversations
                    .FirstAsync(c => c.Type == ChatConversationType.Team, ct);
            }
        }

        return await MapConversationAsync(team, currentUserId, ct);
    }

    public async Task<ChatConversationDto> GetOrCreateDirectAsync(
        string currentUserId,
        string peerUserId,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(peerUserId))
            throw new ArgumentException("Укажите собеседника.");

        peerUserId = peerUserId.Trim();
        if (peerUserId == currentUserId)
            throw new ArgumentException("Нельзя открыть чат с собой.");

        var peer = await _userManager.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == peerUserId && u.IsActive, ct);
        if (peer == null)
            throw new ArgumentException("Сотрудник не найден.");

        var (low, high) = OrderUserIds(currentUserId, peerUserId);
        var existing = await _db.ChatConversations
            .FirstOrDefaultAsync(
                c => c.Type == ChatConversationType.Direct
                    && c.UserIdLow == low
                    && c.UserIdHigh == high,
                ct);

        if (existing != null)
            return await MapConversationAsync(existing, currentUserId, ct);

        var created = new ChatConversation
        {
            Type = ChatConversationType.Direct,
            UserIdLow = low,
            UserIdHigh = high,
            CreatedAt = _time.Now
        };
        _db.ChatConversations.Add(created);
        try
        {
            await _db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            _db.Entry(created).State = EntityState.Detached;
            created = await _db.ChatConversations.FirstAsync(
                c => c.Type == ChatConversationType.Direct
                    && c.UserIdLow == low
                    && c.UserIdHigh == high,
                ct);
        }

        return await MapConversationAsync(created, currentUserId, ct);
    }

    public async Task EnsureCanAccessAsync(string currentUserId, long conversationId, CancellationToken ct = default)
    {
        var conv = await _db.ChatConversations.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == conversationId, ct)
            ?? throw new UnauthorizedAccessException("Диалог не найден.");

        if (!CanAccess(conv, currentUserId))
            throw new UnauthorizedAccessException("Нет доступа к диалогу.");
    }

    public async Task<IReadOnlyList<ChatMessageDto>> GetMessagesAsync(
        string currentUserId,
        long conversationId,
        long? beforeId,
        int take,
        CancellationToken ct = default)
    {
        await EnsureCanAccessAsync(currentUserId, conversationId, ct);

        take = Math.Clamp(take, 1, MaxPageSize);
        var conv = await _db.ChatConversations.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == conversationId, ct)
            ?? throw new ArgumentException("Диалог не найден.");

        var query = _db.ChatMessages.AsNoTracking()
            .Where(m => m.ConversationId == conversationId);

        if (beforeId is > 0)
            query = query.Where(m => m.Id < beforeId.Value);

        var rows = await query
            .OrderByDescending(m => m.Id)
            .Take(take)
            .Select(m => new
            {
                m.Id,
                m.ConversationId,
                m.SenderUserId,
                m.Text,
                m.CreatedAt,
                m.EditedAt,
                m.ReplyToMessageId
            })
            .ToListAsync(ct);

        var replyIds = rows
            .Where(r => r.ReplyToMessageId is > 0)
            .Select(r => r.ReplyToMessageId!.Value)
            .Distinct()
            .ToList();

        var replyRows = replyIds.Count == 0
            ? []
            : await _db.ChatMessages.AsNoTracking()
                .Where(m => replyIds.Contains(m.Id))
                .Select(m => new { m.Id, m.SenderUserId, m.Text })
                .ToListAsync(ct);

        var replyAttachments = replyIds.Count == 0
            ? []
            : await _db.ChatAttachments.AsNoTracking()
                .Where(a => replyIds.Contains(a.MessageId))
                .OrderBy(a => a.Id)
                .ToListAsync(ct);
        var replyAttachmentsByMessage = replyAttachments
            .GroupBy(a => a.MessageId)
            .ToDictionary(g => g.Key, g => g.Select(MapAttachmentDto).ToList());

        var replySenderIds = replyRows.Select(r => r.SenderUserId).Distinct().ToList();
        Dictionary<string, string> replySenderNames = new();
        if (replySenderIds.Count > 0)
        {
            replySenderNames = await _userManager.Users.AsNoTracking()
                .Where(u => replySenderIds.Contains(u.Id))
                .Select(u => new { u.Id, u.FullName })
                .ToDictionaryAsync(u => u.Id, u => u.FullName, ct);
        }

        var replyPreviewById = replyRows.ToDictionary(
            r => r.Id,
            r =>
            {
                replyAttachmentsByMessage.TryGetValue(r.Id, out var replyFiles);
                replySenderNames.TryGetValue(r.SenderUserId, out var replySenderName);
                return new ChatMessageReplyPreviewDto
                {
                    Id = r.Id,
                    SenderUserId = r.SenderUserId,
                    SenderFullName = replySenderName ?? "?",
                    Preview = BuildReplyPreview(r.Text, replyFiles ?? [])
                };
            });

        var messageIds = rows.Select(r => r.Id).ToList();
        var attachments = await _db.ChatAttachments.AsNoTracking()
            .Where(a => messageIds.Contains(a.MessageId))
            .OrderBy(a => a.Id)
            .ToListAsync(ct);
        var attachmentsByMessage = attachments
            .GroupBy(a => a.MessageId)
            .ToDictionary(g => g.Key, g => g.Select(MapAttachmentDto).ToList());

        var senderIds = rows.Select(r => r.SenderUserId).Distinct().ToList();
        var senders = await _userManager.Users.AsNoTracking()
            .Where(u => senderIds.Contains(u.Id))
            .Select(u => new { u.Id, u.FullName, u.AvatarUrl })
            .ToDictionaryAsync(u => u.Id, ct);

        // Peer last-read for Direct chats → Telegram-style sent/read ticks on own messages.
        long peerLastRead = 0;
        if (conv.Type == ChatConversationType.Direct)
        {
            var peerId = conv.UserIdLow == currentUserId ? conv.UserIdHigh! : conv.UserIdLow!;
            peerLastRead = await _db.ChatReadStates.AsNoTracking()
                .Where(r => r.UserId == peerId && r.ConversationId == conversationId)
                .Select(r => (long?)r.LastReadMessageId)
                .FirstOrDefaultAsync(ct) ?? 0;
        }

        return rows
            .OrderBy(r => r.Id)
            .Select(r =>
            {
                senders.TryGetValue(r.SenderUserId, out var sender);
                attachmentsByMessage.TryGetValue(r.Id, out var files);
                string? status = null;
                if (r.SenderUserId == currentUserId)
                {
                    status = conv.Type == ChatConversationType.Direct && r.Id <= peerLastRead
                        ? "read"
                        : "sent";
                }

                return new ChatMessageDto
                {
                    Id = r.Id,
                    ConversationId = r.ConversationId,
                    SenderUserId = r.SenderUserId,
                    SenderFullName = sender?.FullName ?? "?",
                    SenderAvatarUrl = sender?.AvatarUrl,
                    Text = r.Text,
                    CreatedAt = r.CreatedAt,
                    EditedAt = r.EditedAt,
                    ReplyToMessageId = r.ReplyToMessageId,
                    ReplyTo = r.ReplyToMessageId is long replyId && replyId > 0
                        && replyPreviewById.TryGetValue(replyId, out var reply)
                        ? reply
                        : null,
                    Status = status,
                    Attachments = files ?? []
                };
            })
            .ToList();
    }

    public async Task<ChatMessageDto> EditMessageAsync(
        string currentUserId,
        long conversationId,
        long messageId,
        string? text,
        CancellationToken ct = default)
    {
        var trimmed = (text ?? "").Trim();
        if (trimmed.Length > MaxMessageLength)
            throw new ArgumentException($"Сообщение длиннее {MaxMessageLength} символов.");

        var conv = await _db.ChatConversations
            .FirstOrDefaultAsync(c => c.Id == conversationId, ct)
            ?? throw new ArgumentException("Диалог не найден.");

        if (!CanAccess(conv, currentUserId))
            throw new UnauthorizedAccessException("Нет доступа к диалогу.");

        var message = await _db.ChatMessages
            .Include(m => m.Attachments)
            .FirstOrDefaultAsync(m => m.Id == messageId && m.ConversationId == conversationId, ct)
            ?? throw new ArgumentException("Сообщение не найдено.");

        if (message.SenderUserId != currentUserId)
            throw new UnauthorizedAccessException("Можно редактировать только свои сообщения.");

        var hasAttachments = message.Attachments.Count > 0;
        if (string.IsNullOrEmpty(trimmed) && !hasAttachments)
            throw new ArgumentException("Сообщение пустое.");

        if (string.Equals(message.Text, trimmed, StringComparison.Ordinal))
        {
            return await ToMessageDtoAsync(message, currentUserId, conv, ct);
        }

        message.Text = trimmed;
        message.EditedAt = _time.Now;
        await _db.SaveChangesAsync(ct);

        var dto = await ToMessageDtoAsync(message, currentUserId, conv, ct);
        await BroadcastMessageUpdatedAsync(conv, currentUserId, dto, ct);

        if (conv.Type == ChatConversationType.Team)
        {
            await _hub.Clients.Group(ChatGroups.Team)
                .SendAsync("ChatConversationUpdated", conversationId, ct);
        }
        else
        {
            var peerId = conv.UserIdLow == currentUserId ? conv.UserIdHigh! : conv.UserIdLow!;
            await _hub.Clients.Groups(currentUserId, peerId)
                .SendAsync("ChatConversationUpdated", conversationId, ct);
        }

        return dto;
    }

    public async Task<ChatMessageDto> SendMessageAsync(
        string currentUserId,
        long conversationId,
        string? text,
        IReadOnlyList<IFormFile>? files,
        long? replyToMessageId = null,
        CancellationToken ct = default)
    {
        var trimmed = (text ?? "").Trim();
        var fileList = (files ?? Array.Empty<IFormFile>())
            .Where(f => f is { Length: > 0 })
            .ToList();

        if (string.IsNullOrEmpty(trimmed) && fileList.Count == 0)
            throw new ArgumentException("Сообщение пустое.");
        if (trimmed.Length > MaxMessageLength)
            throw new ArgumentException($"Сообщение длиннее {MaxMessageLength} символов.");
        if (fileList.Count > MaxAttachmentsPerMessage)
            throw new ArgumentException($"Не больше {MaxAttachmentsPerMessage} файлов.");

        foreach (var file in fileList)
            ValidateAttachment(file);

        var conv = await _db.ChatConversations
            .FirstOrDefaultAsync(c => c.Id == conversationId, ct)
            ?? throw new ArgumentException("Диалог не найден.");

        if (!CanAccess(conv, currentUserId))
            throw new UnauthorizedAccessException("Нет доступа к диалогу.");

        long? validatedReplyId = null;
        if (replyToMessageId is > 0)
        {
            var replyExists = await _db.ChatMessages.AsNoTracking()
                .AnyAsync(m => m.Id == replyToMessageId && m.ConversationId == conversationId, ct);
            if (!replyExists)
                throw new ArgumentException("Сообщение для ответа не найдено.");
            validatedReplyId = replyToMessageId;
        }

        var sender = await _userManager.FindByIdAsync(currentUserId)
            ?? throw new UnauthorizedAccessException("Пользователь не найден.");

        var message = new ChatMessage
        {
            ConversationId = conversationId,
            SenderUserId = currentUserId,
            Text = trimmed,
            CreatedAt = _time.Now,
            ReplyToMessageId = validatedReplyId
        };
        _db.ChatMessages.Add(message);

        var read = await _db.ChatReadStates
            .FirstOrDefaultAsync(r => r.UserId == currentUserId && r.ConversationId == conversationId, ct);
        if (read == null)
        {
            read = new ChatReadState
            {
                UserId = currentUserId,
                ConversationId = conversationId,
                LastReadMessageId = 0,
                UpdatedAt = _time.Now
            };
            _db.ChatReadStates.Add(read);
        }

        await _db.SaveChangesAsync(ct);

        var savedAttachments = new List<ChatAttachment>();
        if (fileList.Count > 0)
        {
            var folder = GetMessageUploadFolder(message.Id);
            Directory.CreateDirectory(folder);

            foreach (var file in fileList)
            {
                var safeName = SanitizeFileName(file.FileName);
                var storedName = $"{Guid.NewGuid():N}_{safeName}";
                var fullPath = Path.Combine(folder, storedName);
                await using (var stream = new FileStream(fullPath, FileMode.Create, FileAccess.Write))
                    await file.CopyToAsync(stream, ct);

                var attachment = new ChatAttachment
                {
                    MessageId = message.Id,
                    FileName = safeName,
                    ContentType = ResolveContentType(file.ContentType, safeName),
                    SizeBytes = file.Length,
                    StoragePath = Path.Combine("chat-uploads", message.Id.ToString(), storedName)
                        .Replace('\\', '/'),
                    CreatedAt = _time.Now
                };
                _db.ChatAttachments.Add(attachment);
                savedAttachments.Add(attachment);
            }

            await _db.SaveChangesAsync(ct);
        }

        read.LastReadMessageId = message.Id;
        read.UpdatedAt = _time.Now;
        await _db.SaveChangesAsync(ct);

        message.Attachments = savedAttachments;
        var dto = await ToMessageDtoAsync(message, currentUserId, conv, ct);

        if (conv.Type == ChatConversationType.Team)
        {
            await _hub.Clients.Group(ChatGroups.Team).SendAsync("ChatMessage", dto, ct);
            await _hub.Clients.Group(ChatGroups.Team).SendAsync("ChatConversationUpdated", conversationId, ct);
        }
        else
        {
            var peerId = conv.UserIdLow == currentUserId ? conv.UserIdHigh! : conv.UserIdLow!;
            await _hub.Clients.Groups(currentUserId, peerId).SendAsync("ChatMessage", dto, ct);
            await _hub.Clients.Groups(currentUserId, peerId).SendAsync("ChatConversationUpdated", conversationId, ct);
        }

        await SendChatPushAsync(conv, currentUserId, dto, ct);

        return dto;
    }

    private async Task SendChatPushAsync(
        ChatConversation conv,
        string senderUserId,
        ChatMessageDto dto,
        CancellationToken ct)
    {
        var recipientIds = new List<string>();
        if (conv.Type == ChatConversationType.Team)
        {
            var teamRecipients = await _userManager.Users
                .AsNoTracking()
                .Where(u => u.IsActive && u.Id != senderUserId)
                .Select(u => u.Id)
                .ToListAsync(ct);
            recipientIds.AddRange(teamRecipients);
        }
        else
        {
            var peerId = conv.UserIdLow == senderUserId ? conv.UserIdHigh! : conv.UserIdLow!;
            recipientIds.Add(peerId);
        }

        var offlineRecipients = recipientIds
            .Where(id => _connections.CountForUser(id) == 0)
            .ToList();
        if (offlineRecipients.Count == 0)
            return;

        var body = BuildChatPushBody(dto);
        await _webPush.SendChatMessageAsync(
            offlineRecipients,
            dto.SenderFullName,
            body,
            dto.ConversationId,
            ct);
    }

    private static string BuildChatPushBody(ChatMessageDto dto)
    {
        var text = (dto.Text ?? "").Trim();
        if (!string.IsNullOrEmpty(text))
            return text.Length > 120 ? $"{text[..119]}…" : text;

        var files = dto.Attachments ?? Array.Empty<ChatAttachmentDto>();
        if (files.Count == 1)
            return $"Файл: {files[0].FileName}";
        if (files.Count > 1)
            return $"{files.Count} файла";

        return "Новое сообщение";
    }

    public async Task MarkReadAsync(
        string currentUserId,
        long conversationId,
        long lastMessageId,
        CancellationToken ct = default)
    {
        await EnsureCanAccessAsync(currentUserId, conversationId, ct);

        if (lastMessageId <= 0)
            return;

        var belongs = await _db.ChatMessages.AsNoTracking()
            .AnyAsync(m => m.Id == lastMessageId && m.ConversationId == conversationId, ct);
        if (!belongs)
            throw new ArgumentException("Сообщение не найдено в диалоге.");

        var read = await _db.ChatReadStates
            .FirstOrDefaultAsync(r => r.UserId == currentUserId && r.ConversationId == conversationId, ct);

        var changed = false;
        if (read == null)
        {
            _db.ChatReadStates.Add(new ChatReadState
            {
                UserId = currentUserId,
                ConversationId = conversationId,
                LastReadMessageId = lastMessageId,
                UpdatedAt = _time.Now
            });
            changed = true;
        }
        else if (lastMessageId > read.LastReadMessageId)
        {
            read.LastReadMessageId = lastMessageId;
            read.UpdatedAt = _time.Now;
            changed = true;
        }

        if (!changed)
            return;

        await _db.SaveChangesAsync(ct);
        // Notify the reader so header badge / conversation list refresh across tabs.
        await _hub.Clients.Group(currentUserId).SendAsync("ChatConversationUpdated", conversationId, ct);

        // Direct only: peer flips own messages sent → read (Telegram ticks).
        // Team chats keep "sent" — no per-member read receipts.
        var conv = await _db.ChatConversations.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == conversationId, ct);
        if (conv is not { Type: ChatConversationType.Direct })
            return;

        var peerId = conv.UserIdLow == currentUserId ? conv.UserIdHigh! : conv.UserIdLow!;
        await _hub.Clients.Group(peerId).SendAsync(
            "ChatMessagesRead",
            conversationId,
            lastMessageId,
            currentUserId,
            ct);
    }

    public async Task<(Stream Stream, string ContentType, string FileName)?> OpenAttachmentAsync(
        string currentUserId,
        long attachmentId,
        CancellationToken ct = default)
    {
        var attachment = await _db.ChatAttachments.AsNoTracking()
            .FirstOrDefaultAsync(a => a.Id == attachmentId, ct);
        if (attachment == null)
            return null;

        var message = await _db.ChatMessages.AsNoTracking()
            .FirstOrDefaultAsync(m => m.Id == attachment.MessageId, ct);
        if (message == null)
            return null;

        await EnsureCanAccessAsync(currentUserId, message.ConversationId, ct);

        var fullPath = MapStoragePath(attachment.StoragePath);
        if (!File.Exists(fullPath))
            return null;

        Stream stream = new FileStream(fullPath, FileMode.Open, FileAccess.Read, FileShare.Read);
        return (stream, attachment.ContentType, attachment.FileName);
    }

    private async Task<ChatConversationDto> MapConversationAsync(
        ChatConversation conv,
        string currentUserId,
        CancellationToken ct)
    {
        var last = await _db.ChatMessages.AsNoTracking()
            .Where(m => m.ConversationId == conv.Id)
            .OrderByDescending(m => m.Id)
            .Select(m => new { m.Id, m.ConversationId, m.SenderUserId, m.Text, m.CreatedAt, m.EditedAt })
            .FirstOrDefaultAsync(ct);

        ChatMessageDto? lastDto = null;
        if (last != null)
        {
            var sender = await _userManager.Users.AsNoTracking()
                .Where(u => u.Id == last.SenderUserId)
                .Select(u => new { u.FullName, u.AvatarUrl })
                .FirstOrDefaultAsync(ct);
            var files = await _db.ChatAttachments.AsNoTracking()
                .Where(a => a.MessageId == last.Id)
                .OrderBy(a => a.Id)
                .ToListAsync(ct);
            lastDto = new ChatMessageDto
            {
                Id = last.Id,
                ConversationId = last.ConversationId,
                SenderUserId = last.SenderUserId,
                SenderFullName = sender?.FullName ?? "?",
                SenderAvatarUrl = sender?.AvatarUrl,
                Text = last.Text,
                CreatedAt = last.CreatedAt,
                EditedAt = last.EditedAt,
                Attachments = files.Select(MapAttachmentDto).ToList()
            };
        }

        var lastRead = await _db.ChatReadStates.AsNoTracking()
            .Where(r => r.UserId == currentUserId && r.ConversationId == conv.Id)
            .Select(r => (long?)r.LastReadMessageId)
            .FirstOrDefaultAsync(ct) ?? 0;

        var unread = await _db.ChatMessages.AsNoTracking()
            .CountAsync(
                m => m.ConversationId == conv.Id
                    && m.Id > lastRead
                    && m.SenderUserId != currentUserId,
                ct);

        var dto = new ChatConversationDto
        {
            Id = conv.Id,
            Type = conv.Type == ChatConversationType.Team ? "Team" : "Direct",
            Title = conv.Type == ChatConversationType.Team ? "Общий чат" : "",
            LastMessage = lastDto,
            UnreadCount = unread
        };

        if (conv.Type == ChatConversationType.Direct)
        {
            var peerId = conv.UserIdLow == currentUserId ? conv.UserIdHigh! : conv.UserIdLow!;
            var peer = await _userManager.Users.AsNoTracking()
                .Where(u => u.Id == peerId)
                .Select(u => new { u.Id, u.FullName, u.AvatarUrl })
                .FirstOrDefaultAsync(ct);
            dto.PeerUserId = peerId;
            dto.PeerFullName = peer?.FullName ?? "?";
            dto.PeerAvatarUrl = peer?.AvatarUrl;
            dto.PeerIsOnline = _connections.CountForUser(peerId) > 0;
            dto.Title = dto.PeerFullName;
        }

        return dto;
    }

    private static ChatAttachmentDto MapAttachmentDto(ChatAttachment a) => new()
    {
        Id = a.Id,
        FileName = a.FileName,
        ContentType = a.ContentType,
        SizeBytes = a.SizeBytes,
        Url = $"/api/chat/attachments/{a.Id}"
    };

    private async Task<ChatMessageDto> ToMessageDtoAsync(
        ChatMessage message,
        string currentUserId,
        ChatConversation conv,
        CancellationToken ct)
    {
        var sender = await _userManager.Users.AsNoTracking()
            .Where(u => u.Id == message.SenderUserId)
            .Select(u => new { u.FullName, u.AvatarUrl })
            .FirstOrDefaultAsync(ct);

        string? status = null;
        if (message.SenderUserId == currentUserId)
        {
            status = "sent";
            if (conv.Type == ChatConversationType.Direct)
            {
                var peerId = conv.UserIdLow == currentUserId ? conv.UserIdHigh! : conv.UserIdLow!;
                var peerLastRead = await _db.ChatReadStates.AsNoTracking()
                    .Where(r => r.UserId == peerId && r.ConversationId == conv.Id)
                    .Select(r => (long?)r.LastReadMessageId)
                    .FirstOrDefaultAsync(ct) ?? 0;
                if (message.Id <= peerLastRead)
                    status = "read";
            }
        }

        List<ChatAttachmentDto> attachments;
        if (message.Attachments != null && message.Attachments.Count > 0)
        {
            attachments = message.Attachments
                .OrderBy(a => a.Id)
                .Select(MapAttachmentDto)
                .ToList();
        }
        else
        {
            var rows = await _db.ChatAttachments.AsNoTracking()
                .Where(a => a.MessageId == message.Id)
                .OrderBy(a => a.Id)
                .ToListAsync(ct);
            attachments = rows.Select(MapAttachmentDto).ToList();
        }

        return new ChatMessageDto
        {
            Id = message.Id,
            ConversationId = message.ConversationId,
            SenderUserId = message.SenderUserId,
            SenderFullName = sender?.FullName ?? "?",
            SenderAvatarUrl = sender?.AvatarUrl,
            Text = message.Text,
            CreatedAt = message.CreatedAt,
            EditedAt = message.EditedAt,
            ReplyToMessageId = message.ReplyToMessageId,
            ReplyTo = await BuildReplyPreviewDtoAsync(message.ReplyToMessageId, ct),
            Status = status,
            Attachments = attachments
        };
    }

    private async Task<ChatMessageReplyPreviewDto?> BuildReplyPreviewDtoAsync(long? replyToMessageId, CancellationToken ct)
    {
        if (replyToMessageId is not > 0) return null;

        var reply = await _db.ChatMessages.AsNoTracking()
            .Where(m => m.Id == replyToMessageId)
            .Select(m => new { m.Id, m.SenderUserId, m.Text })
            .FirstOrDefaultAsync(ct);
        if (reply == null) return null;

        var senderName = await _userManager.Users.AsNoTracking()
            .Where(u => u.Id == reply.SenderUserId)
            .Select(u => u.FullName)
            .FirstOrDefaultAsync(ct) ?? "?";

        var replyFiles = await _db.ChatAttachments.AsNoTracking()
            .Where(a => a.MessageId == reply.Id)
            .OrderBy(a => a.Id)
            .ToListAsync(ct);

        return new ChatMessageReplyPreviewDto
        {
            Id = reply.Id,
            SenderUserId = reply.SenderUserId,
            SenderFullName = senderName,
            Preview = BuildReplyPreview(reply.Text, replyFiles.Select(MapAttachmentDto).ToList())
        };
    }

    private const int ReplyPreviewMaxLength = 24;

    private static string BuildReplyPreview(string text, IReadOnlyList<ChatAttachmentDto> attachments)
    {
        var trimmed = (text ?? "").Trim();
        if (!string.IsNullOrEmpty(trimmed))
            return trimmed.Length > ReplyPreviewMaxLength
                ? $"{trimmed[..ReplyPreviewMaxLength]}…"
                : trimmed;
        if (attachments.Count == 1)
        {
            var fileName = attachments[0].FileName;
            var withIcon = $"📎 {fileName}";
            return withIcon.Length > ReplyPreviewMaxLength
                ? $"{withIcon[..ReplyPreviewMaxLength]}…"
                : withIcon;
        }
        if (attachments.Count > 1)
            return $"{attachments.Count} файла";
        return "Сообщение";
    }

    private async Task BroadcastMessageUpdatedAsync(
        ChatConversation conv,
        string currentUserId,
        ChatMessageDto dto,
        CancellationToken ct)
    {
        if (conv.Type == ChatConversationType.Team)
        {
            await _hub.Clients.Group(ChatGroups.Team).SendAsync("ChatMessageUpdated", dto, ct);
            return;
        }

        var peerId = conv.UserIdLow == currentUserId ? conv.UserIdHigh! : conv.UserIdLow!;
        await _hub.Clients.Groups(currentUserId, peerId).SendAsync("ChatMessageUpdated", dto, ct);
    }

    private void ValidateAttachment(IFormFile file)
    {
        if (file.Length <= 0)
            throw new ArgumentException($"Файл «{file.FileName}» пустой.");

        if (file.Length > MaxAttachmentBytes)
            throw new ArgumentException($"Файл «{file.FileName}» больше 10 МБ.");
    }

    private static string ResolveContentType(string? contentType, string fileName)
    {
        if (!string.IsNullOrWhiteSpace(contentType)
            && !string.Equals(contentType, "application/octet-stream", StringComparison.OrdinalIgnoreCase))
            return contentType;

        return Path.GetExtension(fileName).ToLowerInvariant() switch
        {
            ".jpg" or ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            ".gif" => "image/gif",
            ".webp" => "image/webp",
            ".bmp" => "image/bmp",
            ".svg" => "image/svg+xml",
            ".avif" => "image/avif",
            ".heic" => "image/heic",
            ".heif" => "image/heif",
            ".pdf" => "application/pdf",
            _ => string.IsNullOrWhiteSpace(contentType) ? "application/octet-stream" : contentType
        };
    }

    private string GetMessageUploadFolder(long messageId)
    {
        var webRoot = _env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
        return Path.Combine(webRoot, "chat-uploads", messageId.ToString());
    }

    private string MapStoragePath(string storagePath)
    {
        var webRoot = _env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
        var relative = storagePath.Replace('/', Path.DirectorySeparatorChar);
        return Path.Combine(webRoot, relative);
    }

    private static string SanitizeFileName(string fileName)
    {
        var name = Path.GetFileName(fileName);
        if (string.IsNullOrWhiteSpace(name))
            name = "file";
        foreach (var c in Path.GetInvalidFileNameChars())
            name = name.Replace(c, '_');
        return name.Length > 180 ? name[..180] : name;
    }

    private static bool CanAccess(ChatConversation conv, string userId) =>
        conv.Type == ChatConversationType.Team
        || conv.UserIdLow == userId
        || conv.UserIdHigh == userId;

    private static (string Low, string High) OrderUserIds(string a, string b) =>
        string.CompareOrdinal(a, b) <= 0 ? (a, b) : (b, a);
}
