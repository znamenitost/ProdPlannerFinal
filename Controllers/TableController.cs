using Microsoft.AspNetCore.Mvc;
using ProductionPlanner.Models;
using ProductionPlanner.Data;
using ProductionPlanner.Services;

namespace ProductionPlanner.Controllers
{
    [ApiController]
    [Route("api/table")]
    public class TableController : ControllerBase
    {
        private readonly ITableRowRepository _tableRepo;
        private readonly IProductionTaskRepository _taskRepo;
        private readonly ISyncService _syncService;
        private readonly ITaskLifecycleService _lifecycle;
        private readonly IWorkHoursCalculator _workHours;

        public TableController(
            ITableRowRepository tableRepo, 
            IProductionTaskRepository taskRepo, 
            ISyncService syncService,
            ITaskLifecycleService lifecycle,
            IWorkHoursCalculator workHours)
        {
            _tableRepo = tableRepo;
            _taskRepo = taskRepo;
            _syncService = syncService;
            _lifecycle = lifecycle;
            _workHours = workHours;
        }

        [HttpGet("rows")]
        public async Task<IActionResult> GetRows()
        {
            var rows = await _tableRepo.GetAllRowsAsync();
            return Ok(rows);
        }

        [HttpPost("row")]
        public async Task<IActionResult> CreateRow([FromBody] TableRow row)
        {
            await _tableRepo.AddRowAsync(row);
            await _syncService.SyncTasksFromTable();
            return Ok(row);
        }

        [HttpPut("row/{id}")]
        public async Task<IActionResult> UpdateRow(int id, [FromBody] TableRow row)
        {
            var existing = await _tableRepo.GetRowByIdAsync(id);
            if (existing == null) return NotFound();
            
            existing.FolderPath = row.FolderPath;
            existing.FileName = row.FileName;
            existing.Comment = row.Comment;
            existing.StatusText = row.StatusText;
            existing.Deadline = row.Deadline;
            existing.EstimateHours = row.EstimateHours;
            existing.Type = row.Type;
            existing.EmployeeName = row.EmployeeName;
            existing.ParentRowNumber = row.ParentRowNumber;   // ДОБАВЛЕНО
            existing.UpdatedAt = DateTime.UtcNow;             // ДОБАВЛЕНО
            
            await _tableRepo.UpdateRowAsync(existing);
            await _syncService.SyncTasksFromTable();
            
            return Ok(existing);
        }

        [HttpDelete("row/{id}")]
        public async Task<IActionResult> DeleteRow(int id)
        {
            await _tableRepo.DeleteRowAsync(id);
            await _syncService.SyncTasksFromTable();
            return Ok();
        }

        [HttpPost("row/{id}/start")]
        public async Task<IActionResult> StartTask(int id)
        {
            var row = await _tableRepo.GetRowByIdAsync(id);
            if (row == null) return NotFound();
            
            var now = DebugController.GetCurrentTime();
            
            await _syncService.SyncTasksFromTable();
            var tasks = await _taskRepo.GetAllTasksAsync();
            var task = tasks.FirstOrDefault(t => t.RowNumber == id);
            
            if (task == null)
            {
                return BadRequest(new { message = "ProductionTask не найдена для строки " + id });
            }
            
            if (task.Status == JobStatus.Assigned || task.Status == JobStatus.Paused)
            {
                await _lifecycle.StartTaskAsync(task.Id, now);
                row.StatusText = "Начал";
                await _tableRepo.UpdateRowAsync(row);
            }
            
            await _syncService.SyncTasksFromTable();
            return Ok(row);
        }

        [HttpPost("row/{id}/pause")]
        public async Task<IActionResult> PauseTask(int id)
        {
            var row = await _tableRepo.GetRowByIdAsync(id);
            if (row == null) return NotFound();
            
            var now = DebugController.GetCurrentTime();
            
            await _syncService.SyncTasksFromTable();
            var tasks = await _taskRepo.GetAllTasksAsync();
            var task = tasks.FirstOrDefault(t => t.RowNumber == id);
            
            if (task == null)
            {
                return BadRequest(new { message = "ProductionTask не найдена для строки " + id });
            }
            
            if (task.Status == JobStatus.InProgress)
            {
                var openInterval = task.WorkIntervals.FirstOrDefault(i => i.EndTime == null);
                if (openInterval != null)
                {
                    openInterval.EndTime = now;
                    await _taskRepo.UpdateWorkIntervalAsync(openInterval);
                }
                
                task.Status = JobStatus.Paused;
                await _taskRepo.UpdateTaskAsync(task);
                
                row.StatusText = "Пауза";
                await _tableRepo.UpdateRowAsync(row);
            }
            
            await _syncService.SyncTasksFromTable();
            return Ok(row);
        }

        [HttpPost("row/{id}/resume")]
        public async Task<IActionResult> ResumeTask(int id)
        {
            var row = await _tableRepo.GetRowByIdAsync(id);
            if (row == null) return NotFound();
            
            var now = DebugController.GetCurrentTime();
            
            await _syncService.SyncTasksFromTable();
            var tasks = await _taskRepo.GetAllTasksAsync();
            var task = tasks.FirstOrDefault(t => t.RowNumber == id);
            
            if (task == null)
            {
                return BadRequest(new { message = "ProductionTask не найдена для строки " + id });
            }
            
            if (task.Status == JobStatus.Paused)
            {
                var startTime = _workHours.GetNextWorkStart(now);
                task.Status = JobStatus.InProgress;
                var interval = new WorkInterval { ProductionTaskId = task.Id, StartTime = startTime, EndTime = null };
                await _taskRepo.AddWorkIntervalAsync(interval);
                await _taskRepo.UpdateTaskAsync(task);
                
                row.StatusText = "Начал";
                await _tableRepo.UpdateRowAsync(row);
            }
            
            await _syncService.SyncTasksFromTable();
            return Ok(row);
        }

        [HttpPost("row/{id}/complete")]
        public async Task<IActionResult> CompleteTask(int id)
        {
            var row = await _tableRepo.GetRowByIdAsync(id);
            if (row == null) return NotFound();
            
            var now = DebugController.GetCurrentTime();
            
            await _syncService.SyncTasksFromTable();
            var tasks = await _taskRepo.GetAllTasksAsync();
            var task = tasks.FirstOrDefault(t => t.RowNumber == id);
            
            if (task == null)
            {
                return BadRequest(new { message = "ProductionTask не найдена для строки " + id });
            }
            
            if (task.Status != JobStatus.Completed)
            {
                await _lifecycle.CompleteTaskAsync(task.Id, now);
                row.StatusText = "Готово";
                await _tableRepo.UpdateRowAsync(row);
            }
            
            await _syncService.SyncTasksFromTable();
            return Ok(row);
        }

    }
}