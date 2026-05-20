using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using ProductionPlanner.Infrastructure;
using ProductionPlanner.Models;

namespace ProductionPlanner.Data
{
    public class ApplicationDbContext : IdentityDbContext<User>
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options) { }

        public override int SaveChanges()
        {
            NormalizeDateTimesForPostgres();
            return base.SaveChanges();
        }

        public override int SaveChanges(bool acceptAllChangesOnSuccess)
        {
            NormalizeDateTimesForPostgres();
            return base.SaveChanges(acceptAllChangesOnSuccess);
        }

        public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            NormalizeDateTimesForPostgres();
            return base.SaveChangesAsync(cancellationToken);
        }

        public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
        {
            NormalizeDateTimesForPostgres();
            return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
        }

        private void NormalizeDateTimesForPostgres()
        {
            if (!Database.IsNpgsql())
                return;

            foreach (var entry in ChangeTracker.Entries())
            {
                if (entry.State is EntityState.Detached or EntityState.Unchanged)
                    continue;

                foreach (var property in entry.Properties)
                {
                    if (property.CurrentValue is DateTime dt)
                        property.CurrentValue = PostgresDateTime.ToUtc(dt);
                }
            }
        }

        public DbSet<ProductionTask> ProductionTasks { get; set; }
        public DbSet<WorkInterval> WorkIntervals { get; set; }
        public DbSet<EmployeeStat> EmployeeStats { get; set; }
        public DbSet<TaskSplit> TaskSplits { get; set; }
        public DbSet<UserNotification> UserNotifications { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            
            modelBuilder.Entity<ProductionTask>()
                .HasMany(t => t.WorkIntervals)
                .WithOne(i => i.Task)
                .HasForeignKey(i => i.ProductionTaskId)
                .OnDelete(DeleteBehavior.Cascade);
                
            modelBuilder.Entity<TaskSplit>()
                .HasOne(ts => ts.ChildTask)
                .WithMany(t => t.ChildSplits)
                .HasForeignKey(ts => ts.ChildTaskId)
                .OnDelete(DeleteBehavior.Cascade);
                
            // Настройка таблиц Identity
            modelBuilder.Entity<User>(entity =>
            {
                entity.ToTable("Users");
                entity.Property(u => u.FullName).HasMaxLength(100);
                entity.Property(u => u.Role).HasMaxLength(50);
            });
            
            modelBuilder.Entity<IdentityRole>(entity =>
            {
                entity.ToTable("Roles");
            });
            
            modelBuilder.Entity<IdentityUserRole<string>>(entity =>
            {
                entity.ToTable("UserRoles");
            });
            
            modelBuilder.Entity<IdentityUserClaim<string>>(entity =>
            {
                entity.ToTable("UserClaims");
            });
            
            modelBuilder.Entity<IdentityUserLogin<string>>(entity =>
            {
                entity.ToTable("UserLogins");
            });
            
            modelBuilder.Entity<IdentityRoleClaim<string>>(entity =>
            {
                entity.ToTable("RoleClaims");
            });
            
            modelBuilder.Entity<IdentityUserToken<string>>(entity =>
            {
                entity.ToTable("UserTokens");
            });
        }
    }
}