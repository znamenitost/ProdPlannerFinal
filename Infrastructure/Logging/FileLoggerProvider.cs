using System.Collections.Concurrent;
using System.Text;
using Microsoft.Extensions.Logging;

namespace ProductionPlanner.Infrastructure.Logging;

public sealed class FileLoggerProvider : ILoggerProvider
{
    private readonly string _filePath;
    private readonly ConcurrentDictionary<string, FileLogger> _loggers = new();

    public FileLoggerProvider(string filePath)
    {
        var directory = Path.GetDirectoryName(filePath);
        if (!string.IsNullOrEmpty(directory))
            Directory.CreateDirectory(directory);
        _filePath = filePath;
    }

    public ILogger CreateLogger(string categoryName) =>
        _loggers.GetOrAdd(categoryName, _ => new FileLogger(categoryName, _filePath));

    public void Dispose() => _loggers.Clear();

    private sealed class FileLogger : ILogger
    {
        private readonly string _category;
        private readonly string _filePath;
        private static readonly object Lock = new();

        public FileLogger(string category, string filePath)
        {
            _category = category;
            _filePath = filePath;
        }

        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => logLevel != LogLevel.None;

        public void Log<TState>(
            LogLevel logLevel,
            EventId eventId,
            TState state,
            Exception? exception,
            Func<TState, Exception?, string> formatter)
        {
            if (!IsEnabled(logLevel))
                return;

            var message = formatter(state, exception);
            var line = new StringBuilder()
                .Append('[').Append(DateTime.UtcNow.ToString("O")).Append("] ")
                .Append(logLevel).Append(" ")
                .Append(_category).Append(": ")
                .Append(message);

            if (exception != null)
                line.AppendLine().Append(exception);

            lock (Lock)
            {
                File.AppendAllText(_filePath, line + Environment.NewLine, Encoding.UTF8);
            }
        }
    }
}
