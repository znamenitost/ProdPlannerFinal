namespace ProductionPlanner.Models;

/// <summary>Режим выполнения родительской задачи с несколькими этапами.</summary>
public enum SupplyMode
{
    /// <summary>Обычная одиночная задача или без особой логики этапов.</summary>
    None = 0,

    /// <summary>Последовательное производство по этапам.</summary>
    InternalProduction = 1,

    /// <summary>Общая параллельная задача (все этапы доступны сразу).</summary>
    Cooperative = 2
}
