using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProductionPlanner.Models.Dtos;
using ProductionPlanner.Services.AppSettings;
using ProductionPlanner.Services.LabelPrint;

namespace ProductionPlanner.Controllers;

/// <summary>
/// Редактируемая таблица произвольных наклеек 58×30 мм (кнопка «M» в таблице задач).
/// Содержимое хранится как JSON в AppSettings, печать — через общую очередь PrintAgent.
/// </summary>
[Authorize(Roles = "Admin,Employee")]
[ApiController]
[Route("api/custom-labels")]
public class CustomLabelsController : ControllerBase
{
    private const string SheetKey = "customLabelSheet";
    private const int MaxRows = 200;
    private const int MaxFieldLength = 200;

    private readonly IAppSettingsService _settings;
    private readonly ILabelPrintService _labelPrint;

    public CustomLabelsController(IAppSettingsService settings, ILabelPrintService labelPrint)
    {
        _settings = settings;
        _labelPrint = labelPrint;
    }

    /// <summary>Загрузить сохранённые строки таблицы наклеек.</summary>
    [HttpGet]
    public async Task<ActionResult<CustomLabelSheetDto>> GetSheet(CancellationToken cancellationToken)
    {
        var sheet = await _settings.GetJsonAsync<CustomLabelSheetDto>(SheetKey, cancellationToken);
        return Ok(sheet ?? new CustomLabelSheetDto());
    }

    /// <summary>Сохранить строки таблицы (полная замена).</summary>
    [HttpPut]
    public async Task<ActionResult<CustomLabelSheetDto>> SaveSheet(
        [FromBody] CustomLabelSheetDto? body,
        CancellationToken cancellationToken)
    {
        var sheet = new CustomLabelSheetDto { Rows = Sanitize(body?.Rows) };
        await _settings.SaveJsonAsync(SheetKey, sheet, cancellationToken);
        return Ok(sheet);
    }

    /// <summary>Сохранить строки и поставить наклейки в очередь PrintAgent.</summary>
    [HttpPost("print")]
    public async Task<ActionResult<PrintCustomLabelsResponseDto>> Print(
        [FromBody] PrintCustomLabelsRequestDto? body,
        CancellationToken cancellationToken)
    {
        var rows = Sanitize(body?.Rows);
        if (rows.Count == 0)
            return BadRequest(new { error = "Добавьте хотя бы одну строку для печати" });

        try
        {
            await _settings.SaveJsonAsync(SheetKey, new CustomLabelSheetDto { Rows = rows }, cancellationToken);
            var result = await _labelPrint.EnqueueTextLabelsAsync(rows, cancellationToken);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    private static List<CustomLabelRowDto> Sanitize(List<CustomLabelRowDto>? rows)
    {
        if (rows == null || rows.Count == 0)
            return new List<CustomLabelRowDto>();

        var result = new List<CustomLabelRowDto>(Math.Min(rows.Count, MaxRows));
        foreach (var row in rows)
        {
            if (result.Count >= MaxRows)
                break;

            var caption = Truncate(row.Caption);
            var region = Truncate(row.Region);
            var note = Truncate(row.Note);
            if (caption.Length == 0 && region.Length == 0 && note.Length == 0)
                continue;

            result.Add(new CustomLabelRowDto
            {
                Caption = caption,
                Region = region,
                Note = note,
                Quantity = Math.Clamp(row.Quantity, 1, LabelPrintService.MaxTextLabelCopies)
            });
        }

        return result;
    }

    private static string Truncate(string? value)
    {
        var trimmed = (value ?? "").Trim();
        return trimmed.Length <= MaxFieldLength ? trimmed : trimmed[..MaxFieldLength];
    }
}
