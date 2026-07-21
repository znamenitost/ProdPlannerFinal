using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProductionPlanner.Models.Dtos;
using ProductionPlanner.Services.CustomerOrders;

namespace ProductionPlanner.Controllers;

[Authorize(Roles = "Admin")]
[ApiController]
[Route("api/customer-orders")]
public class CustomerOrderTrackingController : ControllerBase
{
    private readonly ICustomerOrderTrackingService _service;

    public CustomerOrderTrackingController(ICustomerOrderTrackingService service)
    {
        _service = service;
    }

    /// <summary>Создаёт или возвращает публичную ссылку на страницу заказов заказчика задачи.</summary>
    [HttpPost("link/{taskId:int}")]
    public async Task<ActionResult<CustomerOrderLinkDto>> CreateOrGetLink(
        int taskId,
        CancellationToken cancellationToken)
    {
        try
        {
            var baseUrl = $"{Request.Scheme}://{Request.Host.Value}";
            var dto = await _service.CreateOrGetLinkAsync(taskId, baseUrl, cancellationToken);
            return Ok(dto);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>Поиск заказов заказчика по коду получения (для выдачи на стойке).</summary>
    [HttpGet("pickup/{code}")]
    public async Task<ActionResult<PickupCustomerLookupDto>> FindByPickupCode(
        string code,
        CancellationToken cancellationToken)
    {
        var dto = await _service.FindByPickupCodeAsync(code, cancellationToken);
        if (dto == null)
            return NotFound(new { error = "Заказ с таким кодом не найден" });

        return Ok(dto);
    }

    /// <summary>Отметить заказ выданным клиенту.</summary>
    [HttpPost("pickup/{taskId:int}/issue")]
    public async Task<IActionResult> MarkPickedUp(
        int taskId,
        CancellationToken cancellationToken)
    {
        try
        {
            await _service.MarkPickedUpAsync(taskId, cancellationToken);
            return Ok(new { ok = true });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>Выдать все готовые заказы того же заказчика.</summary>
    [HttpPost("pickup/{taskId:int}/issue-all")]
    public async Task<ActionResult<PickupIssueResultDto>> MarkAllReadyPickedUp(
        int taskId,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await _service.MarkAllReadyPickedUpAsync(taskId, cancellationToken);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}
