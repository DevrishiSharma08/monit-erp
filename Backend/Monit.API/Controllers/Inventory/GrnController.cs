using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Monit.API.Common.Response;
using Monit.API.Models.DTOs.Inventory;
using Monit.API.Services.Interfaces;

namespace Monit.API.Controllers.Inventory;

[ApiController]
[Route("api/v1/grns")]
[Authorize]
public class GrnController(IGrnService svc) : ControllerBase
{
    private string CurrentUser =>
        User.FindFirst("name")?.Value ??
        User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value ??
        "system";

    // GET api/v1/grns
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] GrnFilterRequest filter)
    {
        var result = await svc.GetAllAsync(filter);
        return Ok(ApiResponse<PagedResult<GrnListDto>>.Ok(result));
    }

    // GET api/v1/grns/{id}
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        try
        {
            var grn = await svc.GetByIdAsync(id);
            return Ok(ApiResponse<GrnDetailDto>.Ok(grn));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<object>.Fail(ex.Message));
        }
    }

    // POST api/v1/grns
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateGrnDto dto)
    {
        try
        {
            var grn = await svc.CreateAsync(dto, CurrentUser);
            return CreatedAtAction(nameof(GetById), new { id = grn.Id },
                ApiResponse<GrnListDto>.Ok(grn, "GRN created successfully."));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<object>.Fail(ex.Message));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse<object>.Fail(ex.Message));
        }
    }

    // PUT api/v1/grns/{id}
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateGrnDto dto)
    {
        try
        {
            var grn = await svc.UpdateAsync(id, dto, CurrentUser);
            return Ok(ApiResponse<GrnDetailDto>.Ok(grn, "GRN updated."));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<object>.Fail(ex.Message));
        }
    }

    // PATCH api/v1/grns/{id}/status
    [HttpPatch("{id:int}/status")]
    public async Task<IActionResult> UpdateStatus(int id, [FromBody] UpdateGrnStatusDto dto)
    {
        try
        {
            var grn = await svc.UpdateStatusAsync(id, dto, CurrentUser);
            return Ok(ApiResponse<GrnDetailDto>.Ok(grn, $"GRN status updated to '{dto.Status}'."));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<object>.Fail(ex.Message));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse<object>.Fail(ex.Message));
        }
    }

    // DELETE api/v1/grns/{id}
    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> Delete(int id)
    {
        try
        {
            await svc.DeleteAsync(id, CurrentUser);
            return Ok(ApiResponse<string>.Ok("deleted", "GRN deleted."));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<object>.Fail(ex.Message));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse<object>.Fail(ex.Message));
        }
    }
}
