using Monit.API.Models.Entities.Auth;

namespace Monit.API.Services.Interfaces;

public interface IJwtService
{
    string   GenerateAccessToken(User user);
    string   GenerateRefreshToken();
    int?     ValidateRefreshTokenAndGetUserId(string refreshToken);
    DateTime AccessTokenExpiry { get; }
}
