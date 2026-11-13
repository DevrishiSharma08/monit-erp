-- ============================================================================
-- FILE : check_db_schema_diff.sql
-- DESC : Compares the schema of TWO databases on the same server and shows
--        exactly what's missing in the second one. Use this to spot any
--        migrations that were applied to MonitPaperDB but skipped on
--        MonitAssociatesDB (or vice-versa).
--
-- HOW TO RUN  (SSMS)
--   1. Connect to the server that holds BOTH databases.
--   2. Open this file (any active DB context is fine — script is
--      explicit about which DB to look at).
--   3. F5 / Execute.
--   4. Read the 4 result grids:
--        Grid 1 — tables present in SOURCE but missing in TARGET
--        Grid 2 — columns present in SOURCE but missing in TARGET
--        Grid 3 — columns where data type / nullability differs
--        Grid 4 — indexes present in SOURCE but missing in TARGET
--
--   If all 4 grids return 0 rows, schemas are identical.
-- ============================================================================

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  Configure which DB is the reference (SOURCE) and which to check    ║
-- ║  (TARGET). Default: MonitPaperDB is source, MonitAssociatesDB is    ║
-- ║  target. Swap them if you want to check the reverse direction.      ║
-- ╚══════════════════════════════════════════════════════════════════════╝

DECLARE @Source NVARCHAR(128) = N'MonitPaperDB';
DECLARE @Target NVARCHAR(128) = N'MonitAssociatesDB';

PRINT '════════════════════════════════════════════════════════════════════';
PRINT '  Schema diff: ' + @Source + '  →  ' + @Target;
PRINT '════════════════════════════════════════════════════════════════════';
GO

-- We use dynamic SQL because object_id() can't be parameterised across DBs.
-- Each grid uses a self-contained query that reads sys.* views from both DBs.

-- ────────────────────────────────────────────────────────────────────────
-- GRID 1 — Tables in SOURCE that don't exist in TARGET
-- ────────────────────────────────────────────────────────────────────────
DECLARE @Source NVARCHAR(128) = N'MonitPaperDB';
DECLARE @Target NVARCHAR(128) = N'MonitAssociatesDB';
DECLARE @sql NVARCHAR(MAX);

SET @sql = N'
SELECT ''MISSING TABLE'' AS [Issue],
       s.name + ''.'' + t.name AS [Schema.Table]
FROM   ' + QUOTENAME(@Source) + N'.sys.tables t
JOIN   ' + QUOTENAME(@Source) + N'.sys.schemas s ON s.schema_id = t.schema_id
WHERE  t.is_ms_shipped = 0
  AND  NOT EXISTS (
        SELECT 1
        FROM   ' + QUOTENAME(@Target) + N'.sys.tables  t2
        JOIN   ' + QUOTENAME(@Target) + N'.sys.schemas s2 ON s2.schema_id = t2.schema_id
        WHERE  s2.name = s.name AND t2.name = t.name)
ORDER BY s.name, t.name;';
EXEC sp_executesql @sql;

-- ────────────────────────────────────────────────────────────────────────
-- GRID 2 — Columns in SOURCE that don't exist in TARGET (same table)
-- ────────────────────────────────────────────────────────────────────────
SET @sql = N'
SELECT ''MISSING COLUMN'' AS [Issue],
       s.name + ''.'' + t.name AS [Schema.Table],
       c.name AS [Column],
       TYPE_NAME(c.user_type_id) +
         CASE
           WHEN TYPE_NAME(c.user_type_id) IN (''nvarchar'',''varchar'',''nchar'',''char'',''binary'',''varbinary'')
             THEN ''('' + CASE WHEN c.max_length=-1 THEN ''MAX'' ELSE CAST(c.max_length AS VARCHAR(10)) END + '')''
           WHEN TYPE_NAME(c.user_type_id) IN (''decimal'',''numeric'')
             THEN ''('' + CAST(c.precision AS VARCHAR(10)) + '','' + CAST(c.scale AS VARCHAR(10)) + '')''
           ELSE ''''
         END AS [Type],
       CASE c.is_nullable WHEN 1 THEN ''NULL'' ELSE ''NOT NULL'' END AS [Nullable]
FROM   ' + QUOTENAME(@Source) + N'.sys.columns c
JOIN   ' + QUOTENAME(@Source) + N'.sys.tables  t ON t.object_id = c.object_id
JOIN   ' + QUOTENAME(@Source) + N'.sys.schemas s ON s.schema_id = t.schema_id
WHERE  t.is_ms_shipped = 0
  AND  NOT EXISTS (
        SELECT 1
        FROM   ' + QUOTENAME(@Target) + N'.sys.columns c2
        JOIN   ' + QUOTENAME(@Target) + N'.sys.tables  t2 ON t2.object_id = c2.object_id
        JOIN   ' + QUOTENAME(@Target) + N'.sys.schemas s2 ON s2.schema_id = t2.schema_id
        WHERE  s2.name = s.name AND t2.name = t.name AND c2.name = c.name)
  AND  EXISTS (
        SELECT 1
        FROM   ' + QUOTENAME(@Target) + N'.sys.tables  t2
        JOIN   ' + QUOTENAME(@Target) + N'.sys.schemas s2 ON s2.schema_id = t2.schema_id
        WHERE  s2.name = s.name AND t2.name = t.name)
ORDER BY s.name, t.name, c.column_id;';
EXEC sp_executesql @sql;

-- ────────────────────────────────────────────────────────────────────────
-- GRID 3 — Columns whose data type / nullability differs between the two
-- ────────────────────────────────────────────────────────────────────────
SET @sql = N'
SELECT ''TYPE MISMATCH'' AS [Issue],
       s.name + ''.'' + t.name AS [Schema.Table],
       c.name AS [Column],
       TYPE_NAME(c.user_type_id)  AS [Source Type],
       c.max_length               AS [Src Len],
       c.is_nullable              AS [Src Nullable],
       TYPE_NAME(c2.user_type_id) AS [Target Type],
       c2.max_length              AS [Tgt Len],
       c2.is_nullable             AS [Tgt Nullable]
FROM   ' + QUOTENAME(@Source) + N'.sys.columns c
JOIN   ' + QUOTENAME(@Source) + N'.sys.tables  t  ON t.object_id  = c.object_id
JOIN   ' + QUOTENAME(@Source) + N'.sys.schemas s  ON s.schema_id  = t.schema_id
JOIN   ' + QUOTENAME(@Target) + N'.sys.schemas s2 ON s2.name      = s.name
JOIN   ' + QUOTENAME(@Target) + N'.sys.tables  t2 ON t2.schema_id = s2.schema_id AND t2.name = t.name
JOIN   ' + QUOTENAME(@Target) + N'.sys.columns c2 ON c2.object_id = t2.object_id AND c2.name = c.name
WHERE  t.is_ms_shipped = 0
  AND  (c.user_type_id <> c2.user_type_id
        OR c.max_length  <> c2.max_length
        OR c.is_nullable <> c2.is_nullable)
ORDER BY s.name, t.name, c.column_id;';
EXEC sp_executesql @sql;

-- ────────────────────────────────────────────────────────────────────────
-- GRID 4 — Indexes present in SOURCE but missing in TARGET (by name)
-- ────────────────────────────────────────────────────────────────────────
SET @sql = N'
SELECT ''MISSING INDEX'' AS [Issue],
       s.name + ''.'' + t.name AS [Schema.Table],
       i.name AS [Index]
FROM   ' + QUOTENAME(@Source) + N'.sys.indexes i
JOIN   ' + QUOTENAME(@Source) + N'.sys.tables  t ON t.object_id = i.object_id
JOIN   ' + QUOTENAME(@Source) + N'.sys.schemas s ON s.schema_id = t.schema_id
WHERE  t.is_ms_shipped = 0
  AND  i.is_primary_key = 0           -- PKs are part of the table create
  AND  i.name IS NOT NULL             -- skip heap rows
  AND  NOT EXISTS (
        SELECT 1
        FROM   ' + QUOTENAME(@Target) + N'.sys.indexes i2
        JOIN   ' + QUOTENAME(@Target) + N'.sys.tables  t2 ON t2.object_id = i2.object_id
        JOIN   ' + QUOTENAME(@Target) + N'.sys.schemas s2 ON s2.schema_id = t2.schema_id
        WHERE  s2.name = s.name AND t2.name = t.name AND i2.name = i.name)
ORDER BY s.name, t.name, i.name;';
EXEC sp_executesql @sql;

PRINT '════════════════════════════════════════════════════════════════════';
PRINT '  Done. If all 4 grids are empty the two DBs are schema-identical.';
PRINT '════════════════════════════════════════════════════════════════════';
GO
