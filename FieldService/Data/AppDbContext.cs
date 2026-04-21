using Microsoft.EntityFrameworkCore;
using FieldService.Models;

namespace FieldService.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<Technician> Technicians => Set<Technician>();
    public DbSet<Availability> Availabilities => Set<Availability>();
    public DbSet<Treatment> Treatments => Set<Treatment>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<Protocol> Protocols => Set<Protocol>();
    public DbSet<Payment> Payments => Set<Payment>();

    protected override void OnModelCreating(ModelBuilder m)
    {
        // ---- Order ----
        m.Entity<Order>(e =>
        {
            e.HasOne(o => o.Treatment).WithMany(t => t.Orders).HasForeignKey(o => o.TreatmentId);
            e.HasOne(o => o.Technician).WithMany(t => t.Orders).HasForeignKey(o => o.TechnicianId);
            e.HasOne(o => o.CreatedBy).WithMany(u => u.CreatedOrders).HasForeignKey(o => o.CreatedByUserId);
            e.HasIndex(o => o.ScheduledDate);
            e.HasIndex(o => new { o.TechnicianId, o.ScheduledDate });
        });

        // ---- Protocol: 1:1 z Order ----
        m.Entity<Protocol>(e =>
        {
            e.HasOne(p => p.Order).WithOne(o => o.Protocol).HasForeignKey<Protocol>(p => p.OrderId);
        });

        // ---- Payment: 1:1 z Order ----
        m.Entity<Payment>(e =>
        {
            e.HasOne(p => p.Order).WithOne(o => o.Payment).HasForeignKey<Payment>(p => p.OrderId);
        });

        // ---- Availability ----
        m.Entity<Availability>(e =>
        {
            e.HasOne(a => a.Technician).WithMany(t => t.Availabilities).HasForeignKey(a => a.TechnicianId);
            e.HasIndex(a => new { a.TechnicianId, a.Date });
        });

        // ---- User ----
        m.Entity<User>(e =>
        {
            e.HasIndex(u => u.Login).IsUnique();
        });

        // ---- Decimal precision ----
        m.Entity<Order>().Property(o => o.Price).HasPrecision(10, 2);
        m.Entity<Payment>().Property(p => p.Amount).HasPrecision(10, 2);
        m.Entity<Treatment>().Property(t => t.DefaultPrice).HasPrecision(10, 2);
    }
}
