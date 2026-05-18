using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using Monit.API.Common.Helpers;
using Monit.API.Models.Entities.Auth;
using Monit.API.Services.Interfaces;

namespace Monit.API.Services.Auth;

public class JwtService(AppConfig config) : IJwtService
{
    public DateTime AccessTokenExpiry => DateTime.UtcNow.AddHours(config.JwtAccessExpiryHours);

    public string GenerateAccessToken(User user)
    {
        var key   = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config.JwtSecret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name,           user.Username),
            new Claim(ClaimTypes.Role,           user.Role),
            new Claim("name",                    user.Name),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        var token = new JwtSecurityToken(
            issuer:             config.JwtIssuer,
            audience:           config.JwtAudience,
            claims:             claims,
            expires:            DateTime.UtcNow.AddHours(config.JwtAccessExpiryHours),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public string GenerateRefreshToken()
        => Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));

    // Refresh token is validated by looking it up in the DB, not by JWT parsing.
    // This method is unused but kept for interface completeness.
    public int? ValidateRefreshTokenAndGetUserId(string refreshToken) => null;
}
