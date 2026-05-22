namespace Monit.API.Models.DTOs.Auth;

public record LoginRequest(string Username, string Password, int CompanyId = 1);

public record LoginResponse(
    string       AccessToken,
    string       TokenType,
    DateTime     ExpiresAt,
    UserInfo     User,
    List<string> Permissions
);

public record UserInfo(
    int    Id,
    string Username,
    string Name,
    string Role,
    string? CustomerName,
    int    CompanyId = 1
);

public record RefreshResponse(
    string   AccessToken,
    string   TokenType,
    DateTime ExpiresAt
);

public record ChangePasswordRequest(
    string CurrentPassword,
    string NewPassword
);
