using System.Threading;

namespace ProductionPlanner.Services;

public interface IAppTimeService
{
    DateTime Now { get; }
    void SetMock(DateTime? mock);
    void ResetMock();
}

public class AppTimeService : IAppTimeService
{
    private static readonly AsyncLocal<DateTime?> _mockDateTime = new();
    private static DateTime? _globalMock;

    public DateTime Now
    {
        get
        {
            if (_mockDateTime.Value.HasValue)
                return _mockDateTime.Value.Value;
            
            if (_globalMock.HasValue)
                return _globalMock.Value;
            
            return DateTime.Now;
        }
    }

    public void SetMock(DateTime? mock)
    {
        _globalMock = mock;
        _mockDateTime.Value = mock;
        Console.WriteLine($"[AppTimeService] Mock set to: {mock}");
    }

    public void ResetMock()
    {
        _globalMock = null;
        _mockDateTime.Value = null;
        Console.WriteLine("[AppTimeService] Mock reset");
    }
}