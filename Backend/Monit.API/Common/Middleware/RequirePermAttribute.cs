using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Monit.API.Common.Response;
using System.Security.Claims;

namespace Monit.API.Common.Middleware;

/// <summary>
/// Permission-based authorization. Allows the endpoint when the caller is
/// an Admin (implicit full access) OR their JWT carries the specified
/// "perm" claim (issued from RoleService.AvailablePermissions). Replaces
/// the older role-name-only checks (e.g. Roles = "Admin,Manager") that
/// broke custom roles created via the /users + /roles UI.
///
/// Usage:  [RequirePerm("masters.write")]
/// </summary>
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class, AllowMultiple = false)]
public class RequirePermAttribute(string permission) : Attribute, IAuthorizationFilter
{
    public string Permission { get; } = permission;

    public void OnAuthorization(AuthorizationFilterContext context)
    {
        var user = context.HttpContext.User;

        // Not authenticated at all — let the framework return 401.
        if (user.Identity?.IsAuthenticated != true)
        {
            context.Result = new UnauthorizedResult();
            return;
        }

        // Admin bypass — Admins have implicit full access to everything.
        if (user.IsInRole("Admin")) return;

        // Permission granted via the "perm" JWT claim.
        var hasPerm = user.Claims.Any(c => c.Type == "perm" && c.Value == Permission);
        if (hasPerm) return;

        // Otherwise — 403 with a friendly, actionable message that the
        // frontend toast can surface as-is (no cryptic "Request failed (403)").
        context.Result = new ObjectResult(
            ApiResponse.Fail("You don't have permission for this action. Please contact your administrator to grant access."))
        {
            StatusCode = StatusCodes.Status403Forbidden,
        };
    }
}
