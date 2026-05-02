using Microsoft.EntityFrameworkCore;
using ProductionPlanner.Models;

namespace ProductionPlanner.Data
{
    public class ProductionTaskRepository : IProductionTaskRepository
    {
        private readonly ApplicationDbContext _context;

        public ProductionTaskRepository(ApplicationDbContext context)
        {
            _context = context;
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
                .FirstOrDefaultAsync(t => t.RowNumber == rowNumber);
        }

        public async Task AddTaskAsync(ProductionTask task)
        {
            await _context.ProductionTasks.AddAsync(task);
            await _context.SaveChangesAsync();
        }

        public async Task UpdateTaskAsync(ProductionTask task)
        {
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
    }
}