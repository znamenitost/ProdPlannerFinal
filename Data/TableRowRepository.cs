// === ./Data/TableRowRepository.cs ===
using Microsoft.EntityFrameworkCore;
using ProductionPlanner.Models;

namespace ProductionPlanner.Data
{
    public class TableRowRepository : ITableRowRepository
    {
        private readonly ApplicationDbContext _context;

        public TableRowRepository(ApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<List<TableRow>> GetAllRowsAsync()
        {
            return await _context.TableRows
                .OrderBy(r => r.DisplayOrder)
                .ToListAsync();
        }

        public async Task<TableRow?> GetRowByIdAsync(int id)
        {
            return await _context.TableRows.FindAsync(id);
        }

        public async Task AddRowAsync(TableRow row)
        {
            // Новая строка получает DisplayOrder = -1, чтобы стать первой
            row.DisplayOrder = -1;
            row.CreatedAt = DateTime.UtcNow;
            row.UpdatedAt = DateTime.UtcNow;
            await _context.TableRows.AddAsync(row);
            await _context.SaveChangesAsync();
            
            // Обновляем порядок
            await ReorderRowsAsync(null);
        }

        public async Task UpdateRowAsync(TableRow row)
        {
            row.UpdatedAt = DateTime.UtcNow;
            _context.TableRows.Update(row);
            await _context.SaveChangesAsync();
        }

        public async Task DeleteRowAsync(int id)
        {
            var row = await GetRowByIdAsync(id);
            if (row != null)
            {
                _context.TableRows.Remove(row);
                await _context.SaveChangesAsync();
                await ReorderRowsAsync(null);
            }
        }

        public async Task ReorderRowsAsync(List<int>? orderedIds)
        {
            var allRows = await _context.TableRows.OrderBy(r => r.DisplayOrder).ToListAsync();
            
            if (orderedIds != null)
            {
                var order = 0;
                foreach (var id in orderedIds)
                {
                    var row = allRows.FirstOrDefault(r => r.Id == id);
                    if (row != null)
                    {
                        row.DisplayOrder = order;
                        order++;
                    }
                }
                // Добавляем строки, которых нет в orderedIds, в конец
                foreach (var row in allRows.Where(r => !orderedIds.Contains(r.Id)))
                {
                    row.DisplayOrder = order;
                    order++;
                }
            }
            else
            {
                // Переиндексация с 0
                for (int i = 0; i < allRows.Count; i++)
                {
                    allRows[i].DisplayOrder = i;
                }
            }
            
            await _context.SaveChangesAsync();
        }

        public async Task<List<TableRow>> GetActiveRowsAsync()
        {
            return await _context.TableRows
                .Where(r => r.StatusText != "Готово" && (r.StatusText == null || !r.StatusText.StartsWith("Разделена")))
                .OrderBy(r => r.DisplayOrder)
                .ToListAsync();
        }

        public async Task<TableRow?> GetRowByFileNamesAsync(string folderPath, string fileName)
        {
            return await _context.TableRows
                .FirstOrDefaultAsync(r => r.FolderPath == folderPath && r.FileName == fileName);
        }

        public async Task UpdateParentRowStatusAsync(int parentRowId, string status)
        {
            var parentRow = await GetRowByIdAsync(parentRowId);
            if (parentRow != null)
            {
                parentRow.StatusText = status;
                parentRow.UpdatedAt = DateTime.UtcNow;
                await UpdateRowAsync(parentRow);
            }
        }
    }
}