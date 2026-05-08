using Microsoft.EntityFrameworkCore;
using ProductionPlanner.Models;
using ProductionPlanner.Services; 

namespace ProductionPlanner.Data
{
    public class ProductionTaskRepository : IProductionTaskRepository
    {
        private readonly ApplicationDbContext _context;
        private readonly IAppTimeService _timeService;

        public ProductionTaskRepository(ApplicationDbContext context, IAppTimeService timeService)
        {
            _context = context;
            _timeService = timeService;
        }

        public async Task<List<ProductionTask>> GetActiveTasksAsync(string employeeName)
        {
            return await _context.ProductionTasks
                .Include(t => t.WorkIntervals)
                .Where(t => t.EmployeeName == employeeName && t.Status != JobStatus.Completed)
                .ToListAsync();
        }

        public async Task<List<ProductionTask>> GetCompletedTasksAsync(string employeeName)
        {
            return await _context.ProductionTasks
                .Include(t => t.WorkIntervals)
                .Where(t => t.EmployeeName == employeeName && t.Status == JobStatus.Completed)
                .ToListAsync();
        }

        public async Task<ProductionTask?> GetTaskByIdAsync(int id)
        {
            return await _context.ProductionTasks
                .Include(t => t.WorkIntervals)
                .FirstOrDefaultAsync(t => t.Id == id);
        }

        public async Task<ProductionTask?> GetTaskByRowNumberAsync(int rowNumber)
        {
            return await _context.ProductionTasks
                .Include(t => t.WorkIntervals)
                .FirstOrDefaultAsync(t => t.Id == rowNumber);
        }

        public async Task AddTaskAsync(ProductionTask task)
        {
            task.CreatedAt = _timeService.Now;
            task.UpdatedAt = _timeService.Now;
            await _context.ProductionTasks.AddAsync(task);
            await _context.SaveChangesAsync();
        }

        public async Task UpdateTaskAsync(ProductionTask task)
        {
            task.UpdatedAt = _timeService.Now;
            _context.ProductionTasks.Update(task);
            await _context.SaveChangesAsync();
        }

        public async Task DeleteTaskAsync(int id)
        {
            var task = await GetTaskByIdAsync(id);
            if (task != null)
            {
                _context.ProductionTasks.Remove(task);
                await _context.SaveChangesAsync();
            }
        }

        public async Task DeleteAllTasksAsync()
        {
            var allTasks = await _context.ProductionTasks.ToListAsync();
            _context.ProductionTasks.RemoveRange(allTasks);
            await _context.SaveChangesAsync();
        }

        public async Task AddWorkIntervalAsync(WorkInterval interval)
        {
            await _context.WorkIntervals.AddAsync(interval);
            await _context.SaveChangesAsync();
        }

        public async Task UpdateWorkIntervalAsync(WorkInterval interval)
        {
            _context.WorkIntervals.Update(interval);
            await _context.SaveChangesAsync();
        }

        public async Task DeleteWorkIntervalAsync(WorkInterval interval)
        {
            _context.WorkIntervals.Remove(interval);
            await _context.SaveChangesAsync();
        }

        public async Task DeleteAllWorkIntervalsAsync()
        {
            var allIntervals = await _context.WorkIntervals.ToListAsync();
            _context.WorkIntervals.RemoveRange(allIntervals);
            await _context.SaveChangesAsync();
        }

        public async Task<EmployeeStat?> GetEmployeeStatAsync(string employeeName)
        {
            return await _context.EmployeeStats.FirstOrDefaultAsync(s => s.EmployeeName == employeeName);
        }

        public async Task UpdateEmployeeStatAsync(EmployeeStat stat)
        {
            if (stat.Id == 0)
                await _context.EmployeeStats.AddAsync(stat);
            else
                _context.EmployeeStats.Update(stat);
            await _context.SaveChangesAsync();
        }

        public async Task<List<ProductionTask>> GetAllTasksAsync()
        {
            return await _context.ProductionTasks
                .Include(t => t.WorkIntervals)
                .ToListAsync();
        }

        public async Task<List<ProductionTask>> GetRootTasksAsync()
        {
            return await _context.ProductionTasks
                .Include(t => t.WorkIntervals)
                .Where(t => t.ParentRowNumber == null)
                .OrderBy(t => t.DisplayOrder)
                .ToListAsync();
        }

        public async Task<List<ProductionTask>> GetChildTasksAsync(int parentId)
        {
            return await _context.ProductionTasks
                .Include(t => t.WorkIntervals)
                .Where(t => t.ParentRowNumber == parentId)
                .ToListAsync();
        }

        public async Task ReorderTasksAsync(List<int> orderedIds)
        {
            var allTasks = await _context.ProductionTasks.ToListAsync();
            var order = 0;
            foreach (var id in orderedIds)
            {
                var task = allTasks.FirstOrDefault(t => t.Id == id);
                if (task != null)
                {
                    task.DisplayOrder = order;
                    order++;
                }
            }
            foreach (var task in allTasks.Where(t => !orderedIds.Contains(t.Id)))
            {
                task.DisplayOrder = order;
                order++;
            }
            await _context.SaveChangesAsync();
        }
    }
}