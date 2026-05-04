namespace ProductionPlanner.Services;

public static class AppTime
{
    private static DateTime? _mockDateTime = null;
    
    public static void SetMock(DateTime? mock) => _mockDateTime = mock;
    
    public static DateTime Now => _mockDateTime ?? DateTime.Now;
}