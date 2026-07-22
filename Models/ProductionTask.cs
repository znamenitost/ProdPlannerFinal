using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;

namespace ProductionPlanner.Models
{
    [Index(nameof(EmployeeName))]
    [Index(nameof(Status))]
    [Index(nameof(ParentRowNumber))]
    [Index(nameof(Deadline))]
    [Index(nameof(DisplayOrder))]
    [Index(nameof(CdrPreviewRetryAt))]
    public class ProductionTask
    {
        [Key]
        public int Id { get; set; }
        
        public int DisplayOrder { get; set; }
        
        private string? _folderPath;
        public string FolderPath 
        { 
            get => _folderPath ?? string.Empty;
            set => _folderPath = value;
        }
        
        private string? _fileName;
        public string FileName 
        { 
            get => _fileName ?? string.Empty;
            set => _fileName = value;
        }
        
        private string? _comment;
        public string Comment 
        { 
            get => _comment ?? string.Empty;
            set => _comment = value;
        }

        /// <summary>Комментарий хотя бы раз сохраняли через диалог (иконка в таблице).</summary>
        public bool CommentEditedViaDialog { get; set; }

        /// <summary>
        /// Номинальная «Суета»: без дедлайна и выделенных часов, только факт работы.
        /// </summary>
        public bool IsFuss { get; set; }
        
        public DateTime? Deadline { get; set; }
        public double EstimateHours { get; set; }
        
        private string? _type;
        public string Type 
        { 
            get => _type ?? string.Empty;
            set => _type = value;
        }
        
        private string? _employeeName;
        public string EmployeeName 
        { 
            get => _employeeName ?? string.Empty;
            set => _employeeName = value;
        }
        
        public JobStatus Status { get; set; }
        public bool IsPriorityMarked { get; set; }
        public double Progress { get; set; }
        public double ActualHours { get; set; }
        public DateTime? CompletedAt { get; set; }
        
        public List<WorkInterval> WorkIntervals { get; set; } = new();
        
        public bool Notified { get; set; }
        public bool OverdueNotified { get; set; }
        
        public int? ParentRowNumber { get; set; }
        public bool IsSplitTask { get; set; }
        public bool HiddenFromTaskTable { get; set; }

        /// <summary>Режим выполнения дочерних этапов (параллельный / последовательный).</summary>
        public SupplyMode SupplyMode { get; set; }

        /// <summary>Задача выполняется в два этапа: тест, затем согласование и основная часть.</summary>
        public bool RequiresTestBeforeProduction { get; set; }

        public double TestEstimateHours { get; set; }

        public double ProductionEstimateHours { get; set; }

        public TaskWorkPhase WorkPhase { get; set; }

        /// <summary>Момент завершения тестовой фазы (для учёта интервалов основной части).</summary>
        public DateTime? TestPhaseCompletedAt { get; set; }

        public List<TaskSplit> ChildSplits { get; set; } = new();
        
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }

        /// <summary>Когда повторно попытаться построить превью .cdr (вторая попытка).</summary>
        public DateTime? CdrPreviewRetryAt { get; set; }

        /// <summary>1 — запланирована вторая попытка; 0 — первая ещё не провалена или завершено.</summary>
        public int CdrPreviewRetryAttempts { get; set; }

        /// <summary>Код выдачи для заказчика (буква каталога + 2 цифры), например «А42».</summary>
        [MaxLength(8)]
        public string? PickupCode { get; set; }

        /// <summary>Когда заказ выдали клиенту (null — ещё у нас).</summary>
        public DateTime? PickedUpAt { get; set; }

        /// <summary>Выдан, пока статус ещё не был «Готово» (сотрудник забыл пометить).</summary>
        public bool IssuedWithoutReady { get; set; }
        
        public string FullPath => string.IsNullOrEmpty(FolderPath) ? FileName : $"{FolderPath}/{FileName}";
        
        public string File 
        { 
            get => FullPath;
            set { /* для совместимости */ }
        }

        public string TaskDisplayName
        {
            get
            {
                if (IsFuss && !string.IsNullOrWhiteSpace(Comment))
                    return Comment.Trim();

                if (!string.IsNullOrEmpty(FolderPath))
                {
                    var segments = FolderPath.Split(new[] { '/', '\\' }, StringSplitOptions.RemoveEmptyEntries);
                    if (segments.Length > 0)
                        return segments[^1];
                }
                return FileName;
            }
        }
    }
}