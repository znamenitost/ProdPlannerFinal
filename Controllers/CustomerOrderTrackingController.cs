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
}
