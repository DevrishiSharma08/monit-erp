-- Migration V006: Add Address + GstNumber to CompanyConfig; BothCompaniesAccess to Users
-- Run on BOTH databases: MonitPaperDB and MonitAssociatesDB

-- 1. CompanyConfig: company address and GST number fields
ALTER TABLE system.CompanyConfig
    ADD Address   NVARCHAR(500) NULL,
        GstNumber NVARCHAR(50)  NULL;

-- 2. Users: flag for accounts that can access both companies
ALTER TABLE auth.Users
    ADD BothCompaniesAccess BIT NOT NULL DEFAULT 0;
