using Monit.API.Common.Response;

namespace Monit.API.Models.DTOs.Masters;

public class MQGListDto
{
    public int      Id           { get; set; }
    public string   Code         { get; set; } = string.Empty;
    public int      MillId       { get; set; }
    public string   MillCode     { get; set; } = string.Empty;
    public string   MillName     { get; set; } = string.Empty;
    public int      QualityId    { get; set; }
    public string   QualityGroup { get; set; } = string.Empty;
    public string   QualityName  { get; set; } = string.Empty;
    public int      GsmMin       { get; set; }
    public int      GsmMax       { get; set; }
    public string   Type         { get; set; } = string.Empty;
    public bool     IsActive     { get; set; }
    public DateTime CreatedAt    { get; set; }
}

public class MQGDetailDto : MQGListDto
{
    public DateTime? UpdatedAt { get; set; }
    public string?   UpdatedBy { get; set; }
}

public class CreateMQGDto
{
    public int    MillId    { get; set; }
    public int    QualityId { get; set; }
    public int    GsmMin    { get; set; }
    public int    GsmMax    { get; set; }
    public string Type      { get; set; } = string.Empty;
}

public class UpdateMQGDto : CreateMQGDto
{
    public bool IsActive { get; set; } = true;
}

public class MQGFilterRequest : FilterRequest { }

public class MQGDropdownDto
{
    public int    Id        { get; set; }
    public string Code      { get; set; } = string.Empty;
    public string Label     { get; set; } = string.Empty;
    public int    MillId    { get; set; }
    public int    QualityId { get; set; }
    public int    GsmMin    { get; set; }
    public int    GsmMax    { get; set; }
    public string Type      { get; set; } = string.Empty;
}
