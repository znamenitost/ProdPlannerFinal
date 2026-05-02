// === ./Data/ITableRowRepository.cs ===
using ProductionPlanner.Models;

namespace ProductionPlanner.Data
{
    public interface ITableRowRepository
    {
        Task<List<TableRow>> GetAllRowsAsync();
        Task<TableRow?> GetRowByIdAsync(int id);
        Task AddRowAsync(TableRow row);
        Task UpdateRowAsync(TableRow row);
        Task DeleteRowAsync(int id);
        Task ReorderRowsAsync(List<int> orderedIds);
        Task<List<TableRow>> GetActiveRowsAsync();
        Task<TableRow?> GetRowByFileNamesAsync(string folderPath, string fileName);
    }
}