using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProductionPlanner.Models.Dtos;
using ProductionPlanner.Services.CustomerOrders;

namespace ProductionPlanner.Controllers;

[AllowAnonymous]
[ApiController]
[Route("api/public/customer-orders")]
public class PublicCustomerOrderController : ControllerBase
{
    private readonly ICustomerOrderTrackingService _service;

    public PublicCustomerOrderController(ICustomerOrderTrackingService service)
    {
        _service = service;
    }

    [HttpGet("{token}")]
    public async Task<ActionResult<CustomerOrderPublicDto>> Get(
        string token,
        CancellationToken cancellationToken)
    {
        var dto = await _service.GetPublicPageAsync(token, cancellationToken);
        if (dto == null)
            return NotFound(new { error = "Ссылка не найдена или устарела" });

        return Ok(dto);
    }
}
