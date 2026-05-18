-- ============================================================
-- FILE : 00_schemas.sql
-- DESC : Create all SQL Server schemas for Monit ERP Phase 1
-- RUN  : First — before any other script
-- ============================================================

USE MonitPaperDB;
GO

-- System / infrastructure tables (number sequences, audit, notifications)
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'system')
    EXEC('CREATE SCHEMA [system]');
GO

-- Authentication and user management
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'auth')
    EXEC('CREATE SCHEMA [auth]');
GO

-- All master / lookup data
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'masters')
    EXEC('CREATE SCHEMA [masters]');
GO

-- Customer inquiries and sales orders
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'sales')
    EXEC('CREATE SCHEMA [sales]');
GO

-- Purchase orders and mill tracking
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'procurement')
    EXEC('CREATE SCHEMA [procurement]');
GO

-- Stock lots, GRNs, bin allocations
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'inventory')
    EXEC('CREATE SCHEMA [inventory]');
GO

-- Pick plans, truck load plans, challans, in-transit
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'logistics')
    EXEC('CREATE SCHEMA [logistics]');
GO

PRINT '✓ All schemas created.';
GO
