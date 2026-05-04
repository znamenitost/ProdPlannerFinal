using ProductionPlanner.Data;
using ProductionPlanner.Models;
using ProductionPlanner.Services;

namespace ProductionPlanner.Services
{
    public interface ISyncService
    {
        Task SyncTasksFromTable();
    }

    public class SyncService : ISyncService
    {
        private readonly ITableRowRepository _tableRepo;
        private readonly IProductionTaskRepository _taskRepo;

        public SyncService(ITableRowRepository tableRepo, IProductionTaskRepository taskRepo)
        {
            _tableRepo = tableRepo;
            _taskRepo = taskRepo;
        }

        public async Task SyncTasksFromTable()
        {
            var tableRows = await _tableRepo.GetAllRowsAsync();
            var allTasks = await _taskRepo.GetAllTasksAsync();

            foreach (var row in tableRows)
            {
                try
                {
                    if (row.ParentRowNumber.HasValue && row.ParentRowNumber > 0) continue;
                    if (row.StatusText != null && row.StatusText.StartsWith("Разделена")) continue;
                    if (row.StatusText == "Готово") continue;
                    
                    var existingTask = allTasks.FirstOrDefault(t => t.RowNumber == row.Id && !t.IsSplitTask);
                    var filePath = string.IsNullOrEmpty(row.FolderPath) ? row.FileName : $"{row.FolderPath}/{row.FileName}";

                    if (existingTask == null)
                    {
                        var newTask = new ProductionTask
                        {
                            RowNumber = row.Id,
                            Title = string.IsNullOrEmpty(row.FileName) ? "Без названия" : row.FileName,
                            File = filePath,
                            Comment = row.Comment ?? "",
                            Deadline = row.Deadline,
                            EstimateHours = row.EstimateHours,
                            Type = string.IsNullOrEmpty(row.Type) ? "Резка" : row.Type,
                            EmployeeName = string.IsNullOrEmpty(row.EmployeeName) ? "Дима" : row.EmployeeName,
                            Status = ConvertStatus(row.StatusText ?? ""),
                            Progress = 0,
                            WorkIntervals = new List<WorkInterval>(),
                            IsSplitTask = false,
                            ParentRowNumber = null
                        };
                        await _taskRepo.AddTaskAsync(newTask);
                    }
                    else
                    {
                        existingTask.Title = string.IsNullOrEmpty(row.FileName) ? "Без названия" : row.FileName;
                        existingTask.File = filePath;
                        existingTask.Comment = row.Comment ?? "";
                        existingTask.Deadline = row.Deadline;
                        existingTask.EstimateHours = row.EstimateHours;
                        existingTask.Type = string.IsNullOrEmpty(row.Type) ? "Резка" : row.Type;
                        existingTask.EmployeeName = string.IsNullOrEmpty(row.EmployeeName) ? "Дима" : row.EmployeeName;
                        
                        var newStatus = ConvertStatus(row.StatusText ?? "");
                        if (newStatus == JobStatus.Completed && existingTask.Status != JobStatus.Completed)
                        {
                            existingTask.Status = JobStatus.Completed;
                            existingTask.CompletedAt = AppTime.Now;
                            existingTask.Progress = 1;
                        }
                        else if (newStatus != JobStatus.Completed && existingTask.Status != newStatus)
                        {
                            existingTask.Status = newStatus;
                        }
                        
                        await _taskRepo.UpdateTaskAsync(existingTask);
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[SyncService] Ошибка синхронизации строки {row.Id}: {ex.Message}");
                }
            }
        }

        private JobStatus ConvertStatus(string statusText)
        {
            if (string.IsNullOrEmpty(statusText)) return JobStatus.Assigned;
            if (statusText == "Готово") return JobStatus.Completed;
            if (statusText == "Начал") return JobStatus.InProgress;
            if (statusText == "Пауза") return JobStatus.Paused;
            return JobStatus.Assigned;
        }
    }
}