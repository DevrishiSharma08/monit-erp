using System.Security.Claims;

namespace Monit.API.Common.Helpers;

public static class RoleGuard
{
    // Permission constants — match strings stored in auth.Roles.Permissions JSON
    public const string HideCost  = "financial.hide_cost";
    public const string HidePhone = "contact.hide_phone";

    /// <summary>Returns true if the user's JWT contains the given "perm" claim.</summary>
    public static bool HasPerm(ClaimsPrincipal user, string permission) =>
        user.Claims.Any(c => c.Type == "perm" && c.Value == permission);

    /// <summary>Convenience: should total cost / value be hidden for this user?</summary>
    public static bool ShouldHideCost(ClaimsPrincipal user)  => HasPerm(user, HideCost);

    /// <summary>Convenience: should customer phone number be hidden for this user?</summary>
    public static bool ShouldHidePhone(ClaimsPrincipal user) => HasPerm(user, HidePhone);
}
