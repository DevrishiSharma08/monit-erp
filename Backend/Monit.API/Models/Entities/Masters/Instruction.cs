using Monit.API.Models.Entities.Base;

namespace Monit.API.Models.Entities.Masters;

public class Instruction : BaseEntity
{
    public string? Title        { get; set; }
    public string  ApplicableTo { get; set; } = "All";
    public string  LinesJson    { get; set; } = "[]";
    public bool    IsActive     { get; set; } = true;
}
