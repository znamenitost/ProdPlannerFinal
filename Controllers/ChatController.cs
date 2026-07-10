using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProductionPlanner.Models.Dtos;
using ProductionPlanner.Services;

namespace ProductionPlanner.Controllers;

[Authorize]
[ApiController]
[Route("api/chat")]
public class ChatController : ControllerBase
{
    private readonly IChatService _chat;

    public ChatController(IChatService chat)
    {
        _chat = chat;
    }

    [HttpGet("contacts")]
    public async Task<IActionResult> GetContacts(CancellationToken ct)
    {
        var userId = CurrentUserId();
        if (userId == null) return Unauthorized();
        return Ok(await _chat.GetContactsAsync(userId, ct));
    }

    [HttpGet("conversations")]
    public async Task<IActionResult> GetConversations(CancellationToken ct)
    {
        var userId = CurrentUserId();
        if (userId == null) return Unauthorized();
        return Ok(await _chat.GetConversationsAsync(userId, ct));
    }

    [HttpPost("conversations/team")]
    public async Task<IActionResult> EnsureTeam(CancellationToken ct)
    {
        var userId = CurrentUserId();
        if (userId == null) return Unauthorized();
        return Ok(await _chat.GetOrCreateTeamAsync(userId, ct));
    }

    [HttpPost("conversations/direct")]
    public async Task<IActionResult> OpenDirect([FromBody] OpenDirectChatRequest request, CancellationToken ct)
    {
        var userId = CurrentUserId();
        if (userId == null) return Unauthorized();
        try
        {
            return Ok(await _chat.GetOrCreateDirectAsync(userId, request.UserId, ct));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("conversations/{id:long}/messages")]
    public async Task<IActionResult> GetMessages(
        long id,
        [FromQuery] long? beforeId,
        [FromQuery] int take = ChatService.DefaultPageSize,
        CancellationToken ct = default)
    {
        var userId = CurrentUserId();
        if (userId == null) return Unauthorized();
        try
        {
            return Ok(await _chat.GetMessagesAsync(userId, id, beforeId, take, ct));
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
    }

    [HttpPost("conversations/{id:long}/messages")]
    [RequestSizeLimit(ChatService.MaxAttachmentBytes * ChatService.MaxAttachmentsPerMessage + 1024 * 64)]
    public async Task<IActionResult> SendMessage(long id, CancellationToken ct)
    {
        var userId = CurrentUserId();
        if (userId == null) return Unauthorized();

        string? text = null;
        List<IFormFile>? files = null;

        if (Request.HasFormContentType)
        {
            text = Request.Form["text"].FirstOrDefault();
            files = Request.Form.Files.GetFiles("files").ToList();
            if (files.Count == 0)
                files = Request.Form.Files.ToList();
        }
        else
        {
            var body = await Request.ReadFromJsonAsync<SendChatMessageRequest>(cancellationToken: ct);
            text = body?.Text;
        }

        try
        {
            return Ok(await _chat.SendMessageAsync(userId, id, text, files, ct));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
    }

    [HttpPost("conversations/{id:long}/read")]
    public async Task<IActionResult> MarkRead(
        long id,
        [FromBody] MarkChatReadRequest request,
        CancellationToken ct)
    {
        var userId = CurrentUserId();
        if (userId == null) return Unauthorized();
        try
        {
            await _chat.MarkReadAsync(userId, id, request.LastMessageId, ct);
            return NoContent();
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
    }

    [HttpGet("attachments/{id:long}")]
    public async Task<IActionResult> GetAttachment(long id, CancellationToken ct)
    {
        var userId = CurrentUserId();
        if (userId == null) return Unauthorized();

        try
        {
            var file = await _chat.OpenAttachmentAsync(userId, id, ct);
            if (file == null)
                return NotFound();

            if (file.Value.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
                return File(file.Value.Stream, file.Value.ContentType);

            return File(file.Value.Stream, file.Value.ContentType, file.Value.FileName);
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
    }

    private string? CurrentUserId() => User.FindFirstValue(ClaimTypes.NameIdentifier);
}
