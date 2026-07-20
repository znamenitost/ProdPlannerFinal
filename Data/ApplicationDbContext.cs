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
        public DbSet<LunchInterval> LunchIntervals { get; set; }
        public DbSet<EmployeeStat> EmployeeStats { get; set; }
        public DbSet<TaskSplit> TaskSplits { get; set; }
        public DbSet<UserNotification> UserNotifications { get; set; }
        public DbSet<TaskCdrPreview> TaskCdrPreviews { get; set; }
        public DbSet<AppSetting> AppSettings { get; set; }
        public DbSet<UserMaxLink> UserMaxLinks { get; set; }
        public DbSet<TaskMaxSubscription> TaskMaxSubscriptions { get; set; }
        public DbSet<MaxLinkToken> MaxLinkTokens { get; set; }
        public DbSet<ChatConversation> ChatConversations { get; set; }
        public DbSet<ChatMessage> ChatMessages { get; set; }
        public DbSet<ChatReadState> ChatReadStates { get; set; }
        public DbSet<ChatAttachment> ChatAttachments { get; set; }
        public DbSet<WebPushSubscription> WebPushSubscriptions { get; set; }
        public DbSet<TaskComment> TaskComments { get; set; }
        public DbSet<TaskCommentReadState> TaskCommentReadStates { get; set; }
        public DbSet<CustomerOrderTracking> CustomerOrderTrackings { get; set; }
        public DbSet<PrintJob> PrintJobs { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            
            modelBuilder.Entity<ProductionTask>()
                .HasMany(t => t.WorkIntervals)
                .WithOne(i => i.Task)
                .HasForeignKey(i => i.ProductionTaskId)
                .OnDelete(DeleteBehavior.Cascade);
                
            modelBuilder.Entity<TaskSplit>(entity =>
            {
                entity.HasOne(ts => ts.ChildTask)
                    .WithMany(t => t.ChildSplits)
                    .HasForeignKey(ts => ts.ChildTaskId)
                    .OnDelete(DeleteBehavior.Cascade);
                entity.HasIndex(ts => ts.ParentRowNumber);
            });

            modelBuilder.Entity<ProductionTask>()
                .HasIndex(t => new { t.EmployeeName, t.Status });

            modelBuilder.Entity<ProductionTask>()
                .HasIndex(t => new { t.EmployeeName, t.CompletedAt });

            modelBuilder.Entity<TaskCdrPreview>(entity =>
            {
                entity.ToTable("TaskCdrPreviews");
                entity.Property(p => p.Data).HasColumnType("bytea");
                entity.HasOne(p => p.Task)
                    .WithOne()
                    .HasForeignKey<TaskCdrPreview>(p => p.TaskId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<AppSetting>(entity =>
            {
                entity.ToTable("AppSettings");
                entity.Property(s => s.Key).HasMaxLength(128);
                entity.Property(s => s.Json).HasColumnType("text");
            });

            modelBuilder.Entity<UserMaxLink>(entity =>
            {
                entity.ToTable("UserMaxLinks");
                entity.HasOne(l => l.User)
                    .WithMany()
                    .HasForeignKey(l => l.UserId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<TaskMaxSubscription>(entity =>
            {
                entity.ToTable("TaskMaxSubscriptions");
            });

            modelBuilder.Entity<MaxLinkToken>(entity =>
            {
                entity.ToTable("MaxLinkTokens");
            });

            modelBuilder.Entity<ChatConversation>(entity =>
            {
                entity.ToTable("ChatConversations");
                entity.Property(c => c.UserIdLow).HasMaxLength(450);
                entity.Property(c => c.UserIdHigh).HasMaxLength(450);
                entity.HasIndex(c => c.Type);
                entity.HasIndex(c => new { c.UserIdLow, c.UserIdHigh }).IsUnique();
            });

            modelBuilder.Entity<ChatMessage>(entity =>
            {
                entity.ToTable("ChatMessages");
                entity.HasOne(m => m.Conversation)
                    .WithMany(c => c.Messages)
                    .HasForeignKey(m => m.ConversationId)
                    .OnDelete(DeleteBehavior.Cascade);
                entity.HasIndex(m => new { m.ConversationId, m.Id });
                entity.Property(m => m.SenderUserId).HasMaxLength(450);
                entity.Property(m => m.Text).HasMaxLength(4000);
            });

            modelBuilder.Entity<ChatReadState>(entity =>
            {
                entity.ToTable("ChatReadStates");
                entity.HasOne(r => r.Conversation)
                    .WithMany()
                    .HasForeignKey(r => r.ConversationId)
                    .OnDelete(DeleteBehavior.Cascade);
                entity.HasIndex(r => new { r.UserId, r.ConversationId }).IsUnique();
                entity.Property(r => r.UserId).HasMaxLength(450);
            });

            modelBuilder.Entity<ChatAttachment>(entity =>
            {
                entity.ToTable("ChatAttachments");
                entity.HasOne(a => a.Message)
                    .WithMany(m => m.Attachments)
                    .HasForeignKey(a => a.MessageId)
                    .OnDelete(DeleteBehavior.Cascade);
                entity.HasIndex(a => a.MessageId);
                entity.Property(a => a.FileName).HasMaxLength(260);
                entity.Property(a => a.ContentType).HasMaxLength(120);
                entity.Property(a => a.StoragePath).HasMaxLength(500);
            });

            modelBuilder.Entity<WebPushSubscription>(entity =>
            {
                entity.ToTable("WebPushSubscriptions");
                entity.HasIndex(s => s.Endpoint).IsUnique();
                entity.HasIndex(s => s.UserId);
                entity.Property(s => s.UserId).HasMaxLength(450);
                entity.Property(s => s.Endpoint).HasMaxLength(2048);
                entity.Property(s => s.P256dh).HasMaxLength(256);
                entity.Property(s => s.Auth).HasMaxLength(128);
            });

            modelBuilder.Entity<TaskComment>(entity =>
            {
                entity.ToTable("TaskComments");
                entity.HasOne(c => c.ProductionTask)
                    .WithMany()
                    .HasForeignKey(c => c.ProductionTaskId)
                    .OnDelete(DeleteBehavior.Cascade);
                entity.HasIndex(c => new { c.ProductionTaskId, c.Id });
                entity.Property(c => c.AuthorUserId).HasMaxLength(450);
                entity.Property(c => c.AuthorName).HasMaxLength(100);
                entity.Property(c => c.Text).HasMaxLength(4000);
                entity.Property(c => c.RecipientUserId).HasMaxLength(450);
                entity.Property(c => c.RecipientName).HasMaxLength(100);
            });

            modelBuilder.Entity<TaskCommentReadState>(entity =>
            {
                entity.ToTable("TaskCommentReadStates");
                entity.HasIndex(r => new { r.UserId, r.ProductionTaskId }).IsUnique();
                entity.Property(r => r.UserId).HasMaxLength(450);
            });

            modelBuilder.Entity<CustomerOrderTracking>(entity =>
            {
                entity.ToTable("CustomerOrderTrackings");
                entity.Property(c => c.CustomerKey).HasMaxLength(200);
                entity.Property(c => c.CustomerDisplayName).HasMaxLength(200);
                entity.Property(c => c.PublicToken).HasMaxLength(64);
                entity.HasIndex(c => c.CustomerKey).IsUnique();
                entity.HasIndex(c => c.PublicToken).IsUnique();
            });

            modelBuilder.Entity<PrintJob>(entity =>
            {
                entity.ToTable("PrintJobs");
                entity.Property(j => j.OrderTitle).HasMaxLength(500);
                entity.Property(j => j.PickupCode).HasMaxLength(8);
                entity.Property(j => j.ErrorMessage).HasMaxLength(500);
                entity.Property(j => j.AgentName).HasMaxLength(100);
                entity.HasIndex(j => new { j.Status, j.CreatedAt });
                entity.HasIndex(j => j.TaskId);
            });

            modelBuilder.Entity<ProductionTask>()
                .Property(t => t.PickupCode)
                .HasMaxLength(8);

            modelBuilder.Entity<WorkInterval>()
                .HasIndex(i => new { i.ProductionTaskId, i.StartTime });

            modelBuilder.Entity<WorkInterval>()
                .HasIndex(i => new { i.StartTime, i.EndTime });

            modelBuilder.Entity<LunchInterval>(entity =>
            {
                entity.HasIndex(i => new { i.EmployeeName, i.StartTime });
                entity.HasIndex(i => new { i.EmployeeName, i.EndTime });
                entity.Property(i => i.EmployeeName).HasMaxLength(100);
            });
                
            // Настройка таблиц Identity
            modelBuilder.Entity<User>(entity =>
            {
                entity.ToTable("Users");
                entity.Property(u => u.FullName).HasMaxLength(100);
                entity.Property(u => u.Role).HasMaxLength(50);
                entity.HasIndex(u => u.FullName);
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