# Software Requirements Specification (SRS)

## Monit Paper Agency — Integrated Paper Trading Management System

| Field               | Detail                                                        |
|---------------------|---------------------------------------------------------------|
| **Document Version**| 1.2                                                           |
| **Date**            | 2026-05-19                                                    |
| **Prepared For**    | Monit Paper Sales Agency / Monit Paper Associates, Indore, MP |
| **Prepared By**     | Parmeshwar / Development Team                                 |
| **Status**          | In Development — Phase 1 Backend Integration In Progress      |

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Overall Description](#2-overall-description)
3. [User Roles & Permissions](#3-user-roles--permissions)
4. [System Architecture Overview](#4-system-architecture-overview)
5. [Module 1 — Procurement & Purchase Management](#5-module-1--procurement--purchase-management)
6. [Module 2 — Inventory & Stock Management](#6-module-2--inventory--stock-management)
7. [Module 3 — Sales & Order Management](#7-module-3--sales--order-management)
8. [Module 4 — Customer-Facing App & AI Chatbot](#8-module-4--customer-facing-app--ai-chatbot)
9. [Module 5 — Planning Engine Integration](#9-module-5--planning-engine-integration)
10. [Module 6 — Dispatch & Logistics Management](#10-module-6--dispatch--logistics-management)
11. [Module 7 — Billing, Invoicing & Tally Integration](#11-module-7--billing-invoicing--tally-integration)
12. [Module 8 — Payment & Credit Management](#12-module-8--payment--credit-management)
13. [Module 9 — Quality, Claims & Returns Management](#13-module-9--quality-claims--returns-management)
14. [Module 10 — Reporting, Analytics & Market Intelligence](#14-module-10--reporting-analytics--market-intelligence)
15. [Module 11 — CRM & Customer Relationship Management](#15-module-11--crm--customer-relationship-management)
16. [Module 12 — Configuration & Master Data](#16-module-12--configuration--master-data)
17. [Non-Functional Requirements](#17-non-functional-requirements)
18. [Business Rules Engine](#18-business-rules-engine)
19. [Integration Requirements](#19-integration-requirements)
20. [Data Model Overview](#20-data-model-overview)
21. [Phased Rollout Plan](#21-phased-rollout-plan)
22. [Appendices](#22-appendices)
23. [Appendix F — Frontend Implementation Status (Phase 1)](#appendix-f--frontend-implementation-status-phase-1)

---

## 1. Introduction

### 1.1 Purpose

This Software Requirements Specification (SRS) defines the functional and non-functional requirements for an Integrated Paper Trading Management System to be developed for **Monit Paper Sales Agency** and **Monit Paper Associates**. The system aims to digitize and automate the end-to-end paper trading operations — from procurement and inventory management to sales, dispatch, customer engagement, and reporting.

### 1.2 Scope

The system shall cover:

- **Procurement** from 10–12 authorized paper mills.
- **Inventory management** across multiple godowns and locations in Indore.
- **Sales order lifecycle** — inquiry, quotation, order confirmation, fulfillment, and invoicing.
- **Customer-facing AI chatbot/app** for availability checks, inquiries, and order placement.
- **Planning engine** for carton dimension optimization and paper size recommendation.
- **Dispatch and logistics** including multi-point pickup, truck load planning, and bill interception.
- **Tally ERP integration** for accounting, billing, and payment synchronization.
- **Reporting and analytics** for business intelligence, follow-up tracking, and market insights.
- **Credit and payment management** with rule-based approval workflows.

### 1.3 Business Context

Monit Paper Agency is a 30+ year old paper and paperboard trading business based in Indore, Madhya Pradesh. The agency operates as an authorized distributor for major Indian paper mills and serves the packaging, digital printing, and food-grade packaging industries.

**Two Firms:**
- **Monit Paper Sales Agency** — handles ITC Limited (PSPD) business.
- **Monit Paper Associates** — handles NR Agarwal and other mill business.

Both firms share the same customer base. The internal decision of which firm fulfills an order is made by the sales/management team.

**Business Model:**
- **Direct Indenting** — customer orders, Monit places order with mill, material goes directly or via godown.
- **Stock-and-Sell** — Monit maintains stock; two sub-models:
  - **Bundles** — pre-packed sheets from mills.
  - **Reel Cutting (Sheeter)** — Monit has 2 sheeters to convert reels into custom sheet sizes.

**Key Problem Statement:**
Currently, procurement is managed entirely in Excel and Word documents. Stock tracking uses Google Sheets. Billing runs on Tally. There is no integrated system. The business owner spends significant time manually filtering Excel data for follow-ups and reporting. The goal is to reduce people-dependency and increase system-dependency — "the system should be the expert, not the person."

### 1.4 Definitions & Acronyms

| Term | Definition |
|------|-----------|
| **GSM** | Grams per Square Meter — paper thickness/weight measurement |
| **FBB** | Folding Box Board |
| **SBS** | Solid Bleached Sulfate board |
| **Duplex Board** | Multi-layered paperboard (Grey Back / White Back variants) |
| **Kraft** | Strong brown paper used for packaging |
| **Deckle** | Width of the paper machine / reel width |
| **Reel** | Roll of paper as produced by the mill |
| **Sheeter** | Machine that cuts reels into flat sheets |
| **Trim/Trim Waste** | Edge waste generated during reel-to-sheet cutting |
| **TAT** | Turn Around Time — time from order placement to material readiness |
| **PO** | Purchase Order |
| **SO** | Sales Order |
| **DN/CN** | Debit Note / Credit Note |
| **PDC** | Post-Dated Cheque |
| **Stock Lot** | Non-prime / excess material sold at discounted rates by mills |
| **Indent** | Direct order placed with mill on behalf of customer (no stocking) |
| **E-Way Bill** | Electronic waybill required under GST for goods movement |
| **PSPD** | Paperboards and Specialty Papers Division (of ITC) |
| **Mill Run** | A production batch/cycle at the paper mill |

### 1.5 References

- Minutes of Meeting #1 — Monit (Mohit) & Manoj discussion (workflow, dispatch, stock management)
- Minutes of Meeting #2 — Monit & Parmeshwar discussion (procurement, sales, AI chatbot, planning engine, approval workflows)
- Existing Sheeter App / Planning Engine (API available)
- Vijay Shri Printers — existing client system reference
- Tally ERP — current accounting system

---

## 2. Overall Description

### 2.1 Product Perspective

The system is a **new, standalone web and mobile application** that integrates with:
- **Tally ERP** (existing) — for accounting, billing, and payment data.
- **Planning Engine** (existing) — for carton optimization and paper size recommendation.
- **WhatsApp Business API** — for customer notifications and chatbot interaction.
- **Email systems** — for mill communication and order confirmations.
- **Mill portals (ITC, etc.)** — for order status tracking (manual/API where available).

### 2.2 Product Functions (High-Level)

```
┌─────────────────────────────────────────────────────────────────┐
│                    MONIT PAPER TRADING SYSTEM                   │
├─────────────┬──────────────┬──────────────┬─────────────────────┤
│ PROCUREMENT │  INVENTORY   │    SALES     │   CUSTOMER APP      │
│             │              │              │   & AI CHATBOT       │
│ • Mill Mgmt │ • Multi-loc  │ • Inquiry    │ • Availability Check │
│ • Order to  │ • 5 Statuses │ • Quotation  │ • Size Planning      │
│   Mill      │ • Transit    │ • SO Creation│ • AI Suggestions     │
│ • Delivery  │ • Reel Mgmt  │ • Approval   │ • Order Placement    │
│   Tracking  │ • Sheeter    │ • Fulfillment│ • Order Tracking     │
│ • TAT Mgmt  │ • Stock Lot  │ • Billing    │ • Chatbot Sales      │
├─────────────┼──────────────┼──────────────┼─────────────────────┤
│  DISPATCH   │   BILLING    │   PAYMENTS   │    REPORTING         │
│             │  & TALLY     │  & CREDIT    │   & ANALYTICS        │
│ • Load Plan │ • Invoice Gen│ • Credit Lmt │ • Mill-wise Reports  │
│ • Bill Swap │ • Tally Sync │ • Overdue    │ • Follow-up Reports  │
│ • Tracking  │ • GST/E-Way  │ • Approval   │ • Conversion Rates   │
│ • Multi-Drop│ • DN/CN      │ • PDC Mgmt   │ • Market Intelligence│
└─────────────┴──────────────┴──────────────┴─────────────────────┘
```

### 2.3 User Classes

| User Class | Description | Access Level |
|------------|-------------|--------------|
| **Owner/Director** (Monit, Papa) | Final approval authority, full dashboard, all reports | Full Access |
| **Sales Team** (3+ salesmen) | Inquiry management, quotations, customer interaction, order creation | Sales Module |
| **Purchase/Procurement Team** | Mill orders, delivery tracking, procurement planning | Procurement Module |
| **Accountant** | Tally entries, billing, stock entries, payment tracking | Billing & Accounts |
| **Godown/Warehouse Staff** | Stock receiving, packing slip verification, physical stock updates | Inventory Module |
| **Sheeter Operator** | Reel-to-sheet cutting jobs, trim waste tracking | Sheeter Module |
| **Customer** (via App/Chatbot) | Availability check, inquiry, order placement, order tracking | Customer App |
| **AI Agent** (System) | Automated availability checks, rule-based decisions, notifications | Automated |

### 2.4 Operating Environment

- **Web Application** — Admin panel, dashboards, all internal operations (responsive web).
- **Mobile App** — Customer-facing app with AI chatbot (Android priority, iOS later).
- **WhatsApp Integration** — Chatbot for customers who prefer WhatsApp.
- **Backend** — Cloud-hosted, API-driven architecture.
- **Database** — Relational database with real-time sync capabilities.

### 2.5 Constraints

- Tally remains the primary accounting system; the new system must not replace Tally but must sync with it.
- Customer-facing app must NOT expose stock quantities — only availability (yes/no/partial/timeline).
- Multiple salesmen accessing the same stock pool — real-time conflict resolution is critical.
- Mill portals have varying levels of transparency (ITC is stage-wise; others may be minimal).
- System must handle both firms (Agency + Associates) with unified customer view but separate billing.

### 2.6 Assumptions & Dependencies

- Tally API or bridge is available for real-time or near-real-time data sync.
- Planning Engine API (from existing Sheeter App) is available for integration.
- WhatsApp Business API access is obtainable.
- Internet connectivity is reliable at all Indore locations.
- Mill communication (orders, confirmations) will continue via email; system will generate standardized order documents.

---

## 3. User Roles & Permissions

### 3.1 Role Matrix

The following roles are **implemented in Phase 1** (Frontend Admin Panel). They map to the user classes described in Section 2.3.

| Permission / Module       | Admin | Manager | Salesman | Accountant | Planner | Warehouse Mgr | Driver |
|---------------------------|-------|---------|----------|------------|---------|---------------|--------|
| Dashboard (Full)          | RW    | RW      | R        | R          | R       | -             | -      |
| Customer Master           | RW    | RW      | R        | R          | -       | -             | -      |
| Mill / Supplier Master    | RW    | RW      | R        | R          | R       | -             | -      |
| Inquiry Management        | RW    | RW      | RW       | -          | -       | -             | -      |
| Sales Orders              | RW    | RW      | RW       | R          | R       | -             | -      |
| Order Approval            | RW    | RW      | -        | -          | -       | -             | -      |
| Purchase Orders           | RW    | RW      | R        | R          | RW      | -             | -      |
| Mill Order Tracker        | RW    | RW      | R        | R          | RW      | -             | -      |
| Inventory / Stock         | RW    | RW      | R        | RW         | RW      | RW            | -      |
| GRN (Goods Receipt)       | RW    | R       | -        | R          | RW      | RW            | -      |
| Dispatch Planning         | RW    | RW      | R        | R          | RW      | R             | R      |
| Truck Load Plan           | RW    | RW      | -        | -          | RW      | R             | R      |
| In-Transit Tracking       | RW    | R       | -        | -          | RW      | R             | RW     |
| Billing & Invoicing       | RW    | R       | R        | RW         | -       | -             | -      |
| Payment & Credit          | RW    | R       | -        | RW         | -       | -             | -      |
| Reports                   | RW    | RW      | R (own)  | R (own)    | R (own) | -             | -      |
| Masters / Configuration   | RW    | R       | -        | -          | R       | -             | -      |
| User & Role Management    | RW    | -       | -        | -          | -       | -             | -      |

*R = Read, RW = Read/Write, - = No Access*

**Role → User Class mapping:**

| System Role       | Corresponds to (Section 2.3)              |
|-------------------|-------------------------------------------|
| Admin             | Owner/Director                            |
| Manager           | Owner/Director (delegated) or senior mgr  |
| Salesman          | Sales Team                                |
| Accountant        | Accountant                                |
| Planner           | Purchase/Procurement Team                 |
| Warehouse Manager | Godown/Warehouse Staff                    |
| Driver            | Logistics/Transport (view-only dispatch)  |

### 3.2 Multi-Level Approval Configuration

The system must support configurable multi-level approval chains:

- **Level 1 — System Auto-Approval:** If all rules pass (credit OK, stock available, customer qualified, no overdue), the system auto-approves.
- **Level 2 — Sales Person Review:** For flagged cases (partial stock, minor rule violations), the assigned salesperson reviews and can approve within their authority limit.
- **Level 3 — Owner/Director Approval:** For cases exceeding limits (credit overrun > X%, large orders, blacklisted customers, or any case the salesperson escalates).

The owner can configure:
- Which rules trigger which approval level.
- Authority limits per salesperson (e.g., can approve up to ₹2 lakh orders independently).
- Mandatory escalation thresholds (e.g., if credit utilization > 95%, always escalate).

---

## 4. System Architecture Overview

### 4.1 High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
│  ┌──────────┐  ┌──────────────┐  ┌──────────┐  ┌─────────────┐  │
│  │ Web App  │  │ Mobile App   │  │ WhatsApp │  │ Email       │  │
│  │ (Admin)  │  │ (Customer)   │  │ Chatbot  │  │ Notifications│ │
│  └────┬─────┘  └──────┬───────┘  └────┬─────┘  └──────┬──────┘  │
│       │               │               │               │          │
├───────┴───────────────┴───────────────┴───────────────┴──────────┤
│                         API GATEWAY                              │
├──────────────────────────────────────────────────────────────────┤
│                      APPLICATION LAYER                           │
│  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌───────────────────┐  │
│  │Purchase  │ │Inventory │ │Sales &    │ │AI / Chatbot       │  │
│  │Service   │ │Service   │ │Order Svc  │ │Engine             │  │
│  ├──────────┤ ├──────────┤ ├───────────┤ ├───────────────────┤  │
│  │Dispatch  │ │Billing   │ │Payment &  │ │Reporting &        │  │
│  │Service   │ │Service   │ │Credit Svc │ │Analytics Service  │  │
│  ├──────────┤ ├──────────┤ ├───────────┤ ├───────────────────┤  │
│  │CRM       │ │Planning  │ │Rules      │ │Notification       │  │
│  │Service   │ │Engine API│ │Engine     │ │Service            │  │
│  └──────────┘ └──────────┘ └───────────┘ └───────────────────┘  │
├──────────────────────────────────────────────────────────────────┤
│                      INTEGRATION LAYER                           │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ Tally Bridge │  │ Planning     │  │ WhatsApp Business API  │ │
│  │ (Sync API)   │  │ Engine API   │  │                        │ │
│  └──────────────┘  └──────────────┘  └────────────────────────┘ │
├──────────────────────────────────────────────────────────────────┤
│                        DATA LAYER                                │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ Primary DB   │  │ Cache Layer  │  │ File/Document Storage  │ │
│  │ (PostgreSQL) │  │ (Redis)      │  │ (S3/Blob)              │ │
│  └──────────────┘  └──────────────┘  └────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### 4.2 Key Architectural Decisions

1. **Real-time stock locking** — When a salesperson initiates an order, the corresponding stock quantity is soft-locked (reserved) to prevent conflicts between multiple salesmen.
2. **Event-driven notifications** — All state changes (order placed, approved, dispatched, etc.) trigger notifications to relevant stakeholders.
3. **Rule engine separation** — Business rules (credit limits, approval thresholds, TATs) are stored as configurable data, not hardcoded, so the owner can adjust without code changes.
4. **Tally as source of truth for accounting** — The new system handles operational workflow; Tally remains the ledger. Two-way sync ensures consistency.
5. **AI chatbot as a controlled gateway** — The chatbot never directly commits stock or confirms orders. It either auto-processes (within rules) or escalates to humans.

---

## 5. Module 1 — Procurement & Purchase Management

### 5.1 Overview

This module handles the complete lifecycle of purchasing paper/board from mills — from identifying the need (based on customer orders or stock replenishment) through order placement, delivery tracking, and material receipt.

### 5.2 Functional Requirements

#### 5.2.1 Mill/Supplier Master Management

| ID | Requirement | Priority |
|----|------------|----------|
| PR-001 | System shall maintain a master list of all supplier mills (10–12 currently) with: name, location, contact details, product catalog, authorized dealership details, and payment terms. | High |
| PR-002 | Each mill shall have a configured **product catalog** listing: paper types, GSM range, available deckle widths, standard sheet sizes, and minimum order quantities. | High |
| PR-003 | Each mill-product combination shall have a configurable **TAT (Turn Around Time)** — the expected number of days from order placement to material readiness. | High |
| PR-004 | TAT shall be configurable at multiple levels: mill-level default, product-category level, specific paper/GSM level, and special-run level. Example: ITC FBB 300 GSM = 5 days; ITC FBB 300 GSM special deckle = 15 days. | High |
| PR-005 | System shall store mill-wise pricing: base rates, dealer margins, volume discount slabs, and any active schemes/offers from the mill. | High |
| PR-006 | System shall track **mill scheme/incentive programs** — quarterly targets, volume-based rebates, early payment discounts — and alert when targets are approaching or achievable. | Medium |

#### 5.2.2 Purchase Requisition & Order Creation

| ID | Requirement | Priority |
|----|------------|----------|
| PR-010 | Purchase need shall originate from two sources: (a) Customer sales order requiring material not in stock, and (b) Stock replenishment based on reorder levels or manual decision. | High |
| PR-011 | System shall provide a **Purchase Order Form** with fields: mill name, paper type, GSM, deckle/size, quantity (tons/sheets/reels), required delivery date, customer reference (if indent), and special instructions. | High |
| PR-012 | System shall auto-suggest the **optimal mill** for a given paper requirement based on: TAT, current pricing, truck load optimization (combine with other pending orders for same mill region), and historical fill rate. | Medium |
| PR-013 | When creating POs for the same geographic region (e.g., Vapi with 4 NR units), system shall suggest **club loading** — combining orders across mills for a single truck pickup. | High |
| PR-014 | System shall generate a standardized **Purchase Order PDF** from the order form (replacing current Word → PDF manual process). | High |
| PR-015 | PO shall be emailable directly to the mill from within the system. | High |
| PR-016 | System shall maintain a **Pending Order List** — all POs placed with mills that are not yet fully received. | High |
| PR-017 | Each pending PO shall track: order date, expected delivery date (from mill confirmation), current status, and follow-up history. | High |

#### 5.2.3 Mill Order Tracking & Status

| ID | Requirement | Priority |
|----|------------|----------|
| PR-020 | System shall support the following order statuses (configurable per mill): `Order Placed` → `Order Confirmed by Mill` → `Included in Run` → `Roll/Reel Ready` → `Sheet Cut (if applicable)` → `Packed` → `Ready for Dispatch` → `Dispatched` → `In Transit` → `Received at Godown`. | High |
| PR-021 | For ITC (and mills with detailed tracking), the system shall allow **stage-wise status updates** reflecting the mill's own tracking (order → run included → roll ready → sheet ready → packed). | High |
| PR-022 | Status updates shall be enterable manually (for mills without system integration) or via API/email parsing (future scope for ITC portal integration). | High |
| PR-023 | System shall send **automated follow-up reminders** to the procurement team when delivery dates are approaching or overdue. | High |
| PR-024 | System shall maintain a **delivery date change log** — every time a mill revises a delivery date, the old and new dates are recorded with reason. | Medium |

#### 5.2.4 Material Receipt & Reconciliation

| ID | Requirement | Priority |
|----|------------|----------|
| PR-030 | Upon material dispatch from mill, system shall immediately create a **"Material in Transit"** inventory entry on the same day (not waiting for physical arrival). | High |
| PR-031 | System shall record mill dispatch details: truck/lorry number, driver details, bill copy reference, expected arrival date, and consignment weight as per mill invoice. | High |
| PR-032 | Upon physical arrival at godown, the godown staff shall record: actual received weight, packing slip verification, and any visible damage or shortage. | High |
| PR-033 | System shall perform **weight reconciliation** — compare mill invoice weight vs. actual received weight. If discrepancy exceeds configurable tolerance (e.g., 0.5%), flag for review and initiate shortage claim. | High |
| PR-034 | System shall convert "Material in Transit" to actual godown stock upon receipt confirmation, with the specific godown location recorded. | High |
| PR-035 | System shall maintain a **receipt history** linked to the original PO, enabling full traceability from order to receipt. | Medium |

#### 5.2.5 Procurement Planning & Reporting

| ID | Requirement | Priority |
|----|------------|----------|
| PR-040 | System shall provide a **procurement dashboard** showing: pending orders by mill, expected arrivals this week, overdue deliveries, and material in transit. | High |
| PR-041 | System shall support **mill-wise order consolidation** — view all pending orders for a mill to plan combined dispatches/truck loads. | High |
| PR-042 | System shall track **mill performance metrics**: average TAT vs. promised TAT, order fill rate, quality complaint rate, and weight shortage frequency. | Medium |
| PR-043 | System shall alert when stock of a frequently sold item falls below a configurable reorder level. | Medium |

---

## 6. Module 2 — Inventory & Stock Management

### 6.1 Overview

Inventory is the backbone of the trading operation. The system must manage stock across multiple physical locations, handle reel-to-sheet conversion, and provide real-time visibility while carefully controlling what information is shared externally.

### 6.2 Stock Statuses

The system shall maintain **five distinct stock statuses** (as discussed in MOM):

| Status | Code | Description | Available for Sale? |
|--------|------|-------------|-------------------|
| **Available** | AVL | Physical stock in godown, unallocated | Yes — Immediate |
| **Reel-to-Sheet** | RTS | Available as reel, needs sheeter cutting to fulfill sheet order | Yes — With cutting lead time |
| **Booked/Reserved** | BKD | Available in godown but allocated to a specific customer/job; can be freed if that job is deferred and current need is urgent | Conditional — Needs approval to reallocate |
| **Ordered** | ORD | Purchase order placed with mill, not yet dispatched; advance booking for a specific customer | Yes — With TAT lead time |
| **In Transit** | TRN | Dispatched from mill, in transit to godown; has expected arrival date | Yes — With transit time |

### 6.3 Functional Requirements

#### 6.3.1 Multi-Location Stock Management

| ID | Requirement | Priority |
|----|------------|----------|
| IN-001 | System shall track stock across all Monit locations: Sanwer Road (main warehouse), Rajwada, Kailash Park, and any future locations. | High |
| IN-002 | Each stock entry shall record: location, paper type, mill/brand, GSM, size (or reel deckle width), quantity (sheets/kgs/reels), status (AVL/RTS/BKD/ORD/TRN), and lot/batch reference. | High |
| IN-003 | System shall support **inter-location stock transfers** with full audit trail. | Medium |
| IN-004 | System shall provide a **consolidated stock view** (across all locations) and a **location-wise stock view**. | High |

#### 6.3.2 Real-Time Stock Reservation (Salesman Conflict Prevention)

| ID | Requirement | Priority |
|----|------------|----------|
| IN-010 | When a salesperson initiates an order against available stock, the system shall **soft-lock (reserve)** the specific quantity immediately, changing its status to "Booked" with the salesperson's name, customer reference, and timestamp. | Critical |
| IN-011 | Soft-locks shall have a configurable **expiry period** (e.g., 2 hours). If the order is not confirmed within this period, the lock auto-releases and stock returns to "Available." | High |
| IN-012 | If a second salesperson attempts to book the same stock, the system shall show that the stock is "Booked for [Job/Customer]" with the booking salesperson's name, and offer alternatives (other stock, reel-cut option, order from mill with TAT). | Critical |
| IN-013 | Only the Owner/Director can override a booking and reallocate stock from one customer to another. | High |
| IN-014 | All booking/unbooking actions shall be logged with timestamps and user IDs for audit. | High |

#### 6.3.3 Reel & Sheeter Management

| ID | Requirement | Priority |
|----|------------|----------|
| IN-020 | System shall maintain a **reel inventory** separate from sheet inventory, with reel-specific attributes: deckle width, reel diameter/weight, mill lot number. | High |
| IN-021 | System shall manage **sheeter job orders**: input reel (deckle, GSM), target sheet size, quantity required, and expected output (sheets count + trim waste). | High |
| IN-022 | Upon sheeter job completion, system shall: (a) deduct the reel consumption from reel inventory, (b) add cut sheets to sheet inventory, (c) record trim waste generated. | High |
| IN-023 | System shall track **trim waste** by type, quantity, and value. Trim waste should be tracked as a sellable byproduct. | Medium |
| IN-024 | System shall support **optimization suggestions** — when a sheet order can be fulfilled from an available reel with minimal waste, suggest the reel-cut option with estimated trim waste percentage. | Medium |

#### 6.3.4 Stock Lot (Seconds) Management

| ID | Requirement | Priority |
|----|------------|----------|
| IN-030 | System shall support a **"Stock Lot" flag** on inventory entries — indicating non-prime/seconds material acquired at discounted rates from mills. | High |
| IN-031 | Stock lot material shall have separate pricing (lower than prime) and the system shall track the discounted purchase price vs. the selling price for accurate margin calculation. | High |
| IN-032 | System shall support **strategic stock lot allocation** — the owner can decide whether to offer stock lot to a customer who normally buys prime (to protect margin) or to a price-sensitive customer (to win volume). | Medium |

#### 6.3.5 Stock Visibility Rules (External)

| ID | Requirement | Priority |
|----|------------|----------|
| IN-040 | **CRITICAL:** The customer-facing system shall NEVER display actual stock quantities. Only availability status: "Available," "Partially Available," "Available in X days," or "Not Available." | Critical |
| IN-041 | Even internal daily stock sharing (if any) shall not include quantities — only item availability. This prevents competitors/mills from reverse-engineering turnover and business volume. | Critical |
| IN-042 | The owner shall have the ability to **manually override visibility** — mark specific stock as "hidden" even if physically available (for strategic reservation). | High |

#### 6.3.6 Daily Stock Operations

| ID | Requirement | Priority |
|----|------------|----------|
| IN-050 | System shall support **daily stock update workflow**: godown staff updates physical stock counts, system reconciles with book stock, and flags discrepancies. | High |
| IN-051 | System shall provide a **stock aging report** — how long each item has been in inventory, flagging slow-moving stock for promotion or return to mill. | Medium |
| IN-052 | System shall track **opening stock, additions (purchases/receipts), deductions (sales/dispatches), and closing stock** on a daily basis per item per location. | High |

---

## 7. Module 3 — Sales & Order Management

### 7.1 Overview

Sales is the revenue engine. This module covers the full lifecycle from customer inquiry through order fulfillment. It must support both the traditional salesperson-driven flow and the new AI chatbot-driven flow, with appropriate controls and approvals.

### 7.2 Sales Flow — Two Channels

**Channel 1 — Proactive (Mill-Run Driven):**
1. Mill sends daily run report (what quality/size is being produced).
2. Monit's team matches the run to their customer database (who needs this quality).
3. Team shares availability on customer WhatsApp groups.
4. Inquiries and orders come in response.

**Channel 2 — Reactive (Customer-Initiated):**
1. Customer sends inquiry via WhatsApp, phone, app, or chatbot.
2. Sales team (or AI chatbot) checks availability.
3. Quotation/confirmation sent.
4. Order placed.

### 7.3 Functional Requirements

#### 7.3.1 Inquiry Management

| ID | Requirement | Priority |
|----|------------|----------|
| SL-001 | System shall capture every customer inquiry with: customer name, paper type, GSM, size, quantity, urgency, and source channel (WhatsApp, phone, app, walk-in). | High |
| SL-002 | Inquiries shall be auto-assigned to the salesperson mapped to that customer (or round-robin if unmapped). | High |
| SL-003 | System shall auto-check stock availability upon inquiry creation and display the result to the salesperson: Available (which location, how much), Reel-cut possible, Partially available, On order (with ETA), or Not available. | High |
| SL-004 | System shall track **inquiry-to-order conversion rate** — how many inquiries convert to confirmed orders, and analyze reasons for non-conversion. | High |
| SL-005 | Inquiries not responded to within a configurable SLA (e.g., 5 minutes for app/chatbot, 30 minutes for phone/WhatsApp) shall trigger escalation alerts. | High |
| SL-006 | System shall support **inquiry from mill-run broadcasts**: when team shares a mill-run availability, incoming responses should auto-create inquiries linked to that specific run/stock. | Medium |

#### 7.3.2 Quotation & Pricing

| ID | Requirement | Priority |
|----|------------|----------|
| SL-010 | System shall maintain **customer-wise rate cards** — negotiated rates per paper type, GSM, and mill brand for each customer. | High |
| SL-011 | For customers with locked-in rates, the system shall auto-populate pricing on inquiries/orders without needing manual input. | High |
| SL-012 | For new/non-rate-locked customers, the salesperson shall set the rate manually, with the system showing: mill cost, standard margin, and suggested selling price. | High |
| SL-013 | System shall support **price approval workflow** — if a salesperson offers a rate below a configurable minimum margin, it requires owner approval. | Medium |
| SL-014 | System shall track **mill price changes** — when a mill updates its price list, the system shall flag all affected customer rate cards for review. | Medium |
| SL-015 | System shall manage **stock lot pricing** separately — typically lower than prime pricing, with its own margin tracking. | High |

#### 7.3.3 Sales Order Creation & Confirmation

| ID | Requirement | Priority |
|----|------------|----------|
| SL-020 | System shall generate a **Sales Order (SO)** from a confirmed inquiry with: customer details, paper specification, quantity, rate, delivery terms, firm selection (Agency or Associates), and delivery date commitment. | High |
| SL-021 | The SO serves as the "**full and final**" confirmation. It shall be sent to the customer (via WhatsApp/email/app) with a message: "This is your confirmed order. If there are any discrepancies, inform us before we proceed. If no response within [X hours], we will process as-is." | High |
| SL-022 | Customer shall have the ability to **acknowledge/confirm** the SO (via app, chatbot reply, or manual confirmation logged by salesperson). | High |
| SL-023 | System shall determine the **fulfillment source** for each SO line item: (a) from existing godown stock, (b) from material in transit, (c) from reel-cut, (d) new order to mill (indent or stock purchase). | High |
| SL-024 | For fulfillment source (d), the SO shall automatically trigger a purchase requisition linked to this SO. | High |
| SL-025 | System shall decide **which firm (Agency or Associates)** to bill from, based on: which mill is supplying (ITC → Agency, NR → Associates) and configurable rules. | High |

#### 7.3.4 Order Approval Workflow

| ID | Requirement | Priority |
|----|------------|----------|
| SL-030 | Every order shall pass through an **approval check** before processing. The system shall evaluate: (a) stock availability, (b) customer credit status, (c) payment overdue status, (d) customer qualification/tier, and (e) any custom rules set by owner. | Critical |
| SL-031 | **Auto-Approved Orders:** If ALL rules pass — stock available, credit within limit, no overdue, customer is "qualified/marked" by owner — the order is auto-approved and proceeds to fulfillment. | High |
| SL-032 | **Escalated Orders:** If any rule fails, the order is escalated to the appropriate approver with a summary showing: customer name, order details, stock status, credit utilization (current + this order), overdue amount, and the specific rule(s) that failed. | Critical |
| SL-033 | Approver (Owner/Director) shall see the approval request on their dashboard and mobile with one-touch options: **Approve**, **Approve with Conditions** (e.g., advance payment required), **Hold** (with reason), or **Reject** (with reason). | High |
| SL-034 | If an order is rejected due to credit/payment issues, the system shall NOT communicate "rejected" to the customer. Instead, the diplomatic response shall be: "Stock is currently booked/under allocation. Let me connect you with the sales team." (See Section 8 — AI Chatbot for detailed handling.) | Critical |
| SL-035 | The system shall support **two-step approval** for high-risk cases: if credit utilization drops below a configurable threshold (e.g., only 5% credit remaining), require both salesperson acknowledgment AND owner approval. | Medium |
| SL-036 | Owner shall have a **situational override** — during mill-pressure scenarios (excess stock, need to move material), owner can temporarily relax credit limits for specific customers or globally. This override shall be time-bound and logged. | High |

#### 7.3.5 Order Fulfillment Tracking

| ID | Requirement | Priority |
|----|------------|----------|
| SL-040 | Each SO shall have fulfillment statuses: `Order Confirmed` → `Stock Allocated/Reserved` → `Pending Mill Dispatch (if indent)` → `Material Ready` → `Dispatch Planned` → `Dispatched` → `In Transit` → `Delivered` → `Invoice Generated` → `Payment Pending` → `Closed`. | High |
| SL-041 | System shall provide a **salesperson dashboard** showing: my open orders, my pending inquiries, today's follow-ups, orders awaiting approval, and my customers' overdue payments. | High |
| SL-042 | System shall support **partial fulfillment** — if only part of an order can be fulfilled now, deliver what's available and keep the remainder as a backorder with updated ETA. | Medium |

---

## 8. Module 4 — Customer-Facing App & AI Chatbot

### 8.1 Overview

This is the "game changer" module — a customer-facing interface (mobile app + WhatsApp chatbot) that acts as an AI-powered salesperson. It handles availability checks, suggests alternatives, collects inquiries, and routes orders through the approval system. Crucially, it must behave diplomatically and never expose internal business decisions (credit rejections, stock quantities, etc.) to the customer.

### 8.2 Customer App Features

#### 8.2.1 Availability Search

| ID | Requirement | Priority |
|----|------------|----------|
| CA-001 | Customer shall be able to search for paper by: paper type (Duplex, FBB, SBS, Kraft), GSM, sheet size, and mill brand. | High |
| CA-002 | Search results shall show availability status ONLY — **never quantities**: "Available" (green), "Partially Available" (yellow), "Available in X days" (blue), "Not Available" (red). | Critical |
| CA-003 | For "Available in X days," the system shall calculate the date based on: mill TAT + transit time for that mill. | High |
| CA-004 | Search results shall include **alternative suggestions**: if the exact search is unavailable, suggest nearby GSM (e.g., searched 200 GSM → suggest 210 GSM), nearby sizes, different mill brands, and reel-cut options. | High |
| CA-005 | System shall log **every search** — what the customer searched for, what was available, what alternatives were shown, and whether it led to an inquiry/order. This data feeds market intelligence reporting. | High |

#### 8.2.2 Carton Dimension Input (Planning Engine Interface)

| ID | Requirement | Priority |
|----|------------|----------|
| CA-010 | Customer shall be able to input **carton/box dimensions**: Length, Width, Height, and box type (reverse tuck-in, lock bottom, etc. — ~20–40 standard types). | High |
| CA-011 | If the customer has shared their **machine size** (stored in their profile), the system shall use the Planning Engine to calculate the optimal sheet size considering their specific machine. | High |
| CA-012 | If the customer has NOT shared machine size, the system shall calculate based on standard sheet sizes available in Monit's stock. | High |
| CA-013 | The Planning Engine shall return: recommended sheet size, number of ups (pieces per sheet), estimated wastage %, and whether this size is currently available in stock. | High |
| CA-014 | System shall present multiple plan options (up to top 50, show best 3–5 to customer) ranked by: least wastage, cheapest option, fastest availability. | High |
| CA-015 | If a **matching die** already exists in the system from a previous job, the system shall highlight this: "A compatible die exists — this saves ₹X on die cost." | Medium |

#### 8.2.3 AI Chatbot Behavior

| ID | Requirement | Priority |
|----|------------|----------|
| CA-020 | The AI chatbot shall behave like a **knowledgeable salesperson**, not just a search tool. It shall engage in conversational interaction, understand context, and proactively suggest alternatives. | High |
| CA-021 | **Example interaction flow:** Customer: "Do you have 23x36 Grey Back 290 GSM?" → Chatbot: "Let me check... 23x36 is not in stock right now, but I have 23.5x36 available. Also, in NR I have the exact 23x36 available. And if you can wait 4 days, ITC will have a fresh run. Would you like to explore any of these?" | High |
| CA-022 | If the customer has a known machine size on profile, the chatbot shall factor this in: "I know your machine takes up to 25x36. Based on your box dimensions, 18x23 would actually be more efficient — 12 ups with only 2% waste vs. 6 ups with 8% waste in 23x36. Want me to plan this?" | High |
| CA-023 | Chatbot shall support **reel-cut suggestions**: "This exact size isn't available in sheets, but I can get it cut from a reel. It'll be ready by [time]. The only note — reel-cut finish is slightly different from mill-packed. Want to proceed?" | Medium |
| CA-024 | For **stock lot opportunities**, the chatbot shall proactively mention: "I also have a stock lot of 210 GSM in this brand — I can bill it as 200 GSM at a ₹5/kg discount. Interested?" | Medium |

#### 8.2.4 Chatbot Inquiry & Order Flow (with Hidden Rule Checks)

This is the critical decision tree. The chatbot must **transparently serve the customer while invisibly enforcing business rules.**

| ID | Requirement | Priority |
|----|------------|----------|
| CA-030 | **Step 1 — Availability Check:** Customer asks about a paper. System checks physical stock. If found, proceed. If not found, suggest alternatives and check if customer is interested. | High |
| CA-031 | **Step 2 — Silent Rule Check:** BEFORE confirming availability to the customer, system checks the **Rule Book** (see Section 18): credit limit, overdue status, customer tier, blacklist status, and any owner-set flags. | Critical |
| CA-032 | **Scenario A — All Rules Pass:** System tells customer "Available! Would you like to place an order?" → Customer confirms → Order created → Sent to owner for approval (or auto-approved if customer is "qualified/marked"). | High |
| CA-033 | **Scenario B — Rules Fail (Soft):** Credit is tight or minor overdue exists. System tells customer: "Let me check if this stock is available or already booked for another order. Give me a moment." → Simultaneously sends **internal alert** to owner/salesperson: "[Customer] inquired about [paper]. Stock exists. Credit status: [details]. Overdue: ₹[amount]. Approve availability?" → Owner approves → Chatbot says "Great news, it's available!" / Owner denies → Chatbot says "Unfortunately, this batch is already committed. Let me connect you with our sales team who may find alternatives." | Critical |
| CA-034 | **Scenario C — Rules Fail (Hard):** Customer is blacklisted or severely overdue. System immediately responds: "Let me check with the team on this one. I'll have someone get back to you shortly." → Internal alert to sales team. | High |
| CA-035 | **CRITICAL RULE:** The chatbot shall NEVER tell a customer: "Your payment is overdue," "Your credit limit is exceeded," or anything that reveals the internal financial reason for delay/refusal. All refusals are framed as stock-related or "checking with team." | Critical |
| CA-036 | When the chatbot hands off to the sales team, it shall provide the **full context** to the salesperson: customer name, what they asked for, stock availability, credit status, overdue amount, and the reason for escalation. The salesperson calls the customer with full knowledge. | High |
| CA-037 | **Inquiry Parking:** Even when the chatbot can't confirm an order, it shall record the inquiry. "I've noted your requirement. Our sales team will reach out shortly." — This ensures no inquiry is lost. | High |

#### 8.2.5 Order Tracking (Customer-Facing)

| ID | Requirement | Priority |
|----|------------|----------|
| CA-040 | Customers shall be able to view their order history and current order status in the app. | High |
| CA-041 | Order status shown to customer: `Order Received` → `Order Confirmed` → `Being Prepared` → `Dispatched` → `In Transit` → `Delivered`. (Simplified from internal statuses.) | High |
| CA-042 | Dispatch notifications shall be sent automatically (via app notification + WhatsApp) with: dispatch date, expected delivery date, and basic vehicle info. | High |
| CA-043 | System shall NOT automatically share: exact truck number, driver details, or real-time GPS tracking (this reveals too much about logistics). These can be shared selectively by the salesperson if needed. | Medium |

### 8.3 Customer Profile Management

| ID | Requirement | Priority |
|----|------------|----------|
| CA-050 | Each customer shall have a **profile** storing: company name, contact persons, addresses (delivery locations), machine sizes (if shared), product preferences, preferred mills, and buying patterns. | High |
| CA-051 | Machine size data shall be treated as **premium profile data** — when a customer shares their machine sizes, it unlocks enhanced planning recommendations (specific to their equipment). | High |
| CA-052 | Customer profiles shall feed into the **AI recommendation engine** — over time, the system learns what each customer typically orders and can proactively suggest relevant products. | Medium |
| CA-053 | System shall track **customer qualification status** — "Qualified" (owner-approved for auto-processing), "Standard" (normal flow), "Watch" (tighter scrutiny), "Blocked" (no orders). | High |

---

## 9. Module 5 — Planning Engine Integration

### 9.1 Overview

An existing Planning Engine (from the Sheeter App) is available and already in use by clients like Vijay Shri Printers. This module defines how the trading system integrates with the Planning Engine via API.

### 9.2 Planning Engine Capabilities (Existing)

The Planning Engine currently supports:

1. **Input:** Box type (reverse tuck-in, lock bottom, etc.), Length × Width × Height, quantity, GSM, board type, and optionally: machine size, lamination/finishing requirements.
2. **Processing:** Checks all possible sheet sizes across multiple machine sizes, calculates ups (pieces per sheet), wastage, die requirements, and cost implications.
3. **Output:** Ranked list of plans (up to thousands, top 50 shown) with: recommended sheet size, number of ups, wastage %, cost per piece, and whether a compatible die already exists.

### 9.3 Integration Requirements

| ID | Requirement | Priority |
|----|------------|----------|
| PE-001 | System shall integrate with the Planning Engine via API — **planning only, not costing** (costing is Vijay Shri-specific; Monit needs only paper size optimization). | High |
| PE-002 | When a customer inputs carton dimensions in the app/chatbot, the system shall call the Planning Engine API and display optimized sheet size recommendations. | High |
| PE-003 | Planning Engine results shall be cross-referenced with **current stock availability** — highlight plans that can be fulfilled from existing stock vs. plans requiring new procurement or reel cutting. | High |
| PE-004 | For customers with machine size on profile, the Planning Engine shall factor in machine constraints automatically. | High |
| PE-005 | System shall store **planning history** — what plans were generated for which customers, which plan was selected, and the resulting order. This data improves future recommendations. | Medium |
| PE-006 | Planning Engine shall support a **"what if" mode** — customer or salesperson can modify parameters (change GSM, change box dimensions by ±2mm, change quantity) and instantly see how the optimal plan changes. | Medium |

---

## 10. Module 6 — Dispatch & Logistics Management

### 10.1 Overview

Dispatch management is complex because Monit acts as intermediary — material moves from mill to Monit's godown (or directly to customer), and Monit intercepts the paperwork mid-transit to swap mill invoices with their own.

### 10.2 Functional Requirements

#### 10.2.1 Dispatch Planning

| ID | Requirement | Priority |
|----|------------|----------|
| DL-001 | System shall support **dispatch planning** — grouping ready material by customer, destination, and urgency to create optimal truck loads. | High |
| DL-002 | For inbound procurement (mill → godown), system shall support **multi-point pickup planning**: one truck collects from multiple mills in the same region (e.g., 3–4 NR units in Vapi). | High |
| DL-003 | For outbound delivery (godown → customer), system shall support **multi-drop delivery planning**: one truck delivers to multiple customers on the same route. | High |
| DL-004 | System shall flag when a customer's full order is **truck-load ready** (enough material to fill a truck) vs. when it needs to be combined with other orders. | High |
| DL-005 | Dispatch planning shall consider customer urgency: "Need today" vs. "Can wait 3 days" — urgent items get dispatched even if truck isn't full; non-urgent items can wait for a full load. | High |
| DL-006 | System shall provide a **loading plan document** — generated and sent to the mill/godown specifying: which material to load, truck details, and the sequence of drops. | High |

#### 10.2.2 Bill Interception Workflow

| ID | Requirement | Priority |
|----|------------|----------|
| DL-010 | When mill dispatches material, system shall receive/record the **mill invoice details**: mill invoice number, lorry number, driver info, and quantities. | High |
| DL-011 | System shall automatically **generate Monit's customer invoice** (via Tally integration) based on the SO and confirmed quantities — this invoice replaces the mill invoice at the customer's gate. | High |
| DL-012 | System shall assign a **field person** to intercept the truck en route — the system shows which truck to intercept, where, and provides the printable customer invoices. | High |
| DL-013 | Field person confirms interception in the system: mill invoice collected, Monit invoice handed to driver. | Medium |
| DL-014 | For **direct delivery** (mill → customer, no godown stop), the interception is mandatory — the truck must be intercepted before reaching the customer's gate to swap bills. | High |

#### 10.2.3 Transportation & Freight Management

| ID | Requirement | Priority |
|----|------------|----------|
| DL-020 | System shall maintain a **transporter master**: transporter name, contact, vehicle types, rate per ton/km, and service areas. | Medium |
| DL-021 | System shall track **freight costs** per dispatch — freight in (mill → godown), freight out (godown → customer), and direct delivery freight. | Medium |
| DL-022 | Freight costs shall be allocable to specific SOs — enabling accurate profit calculation per order. | Medium |
| DL-023 | System shall generate **E-Way Bills** for goods movement (GST compliance) — or integrate with the E-Way Bill portal via API. | High |

#### 10.2.4 Delivery Tracking

| ID | Requirement | Priority |
|----|------------|----------|
| DL-030 | System shall track each dispatch: dispatch date, expected arrival, actual arrival, and delivery confirmation. | High |
| DL-031 | The person tracking material transit shall log updates: "Truck crossed [location]," "Expected arrival tomorrow," "Delivered at customer gate — [person received]." | Medium |
| DL-032 | Delivery confirmation shall be recorded with: received by (name), date/time, and any remarks (damage, shortage). | High |
| DL-033 | Customer-facing notifications (via app/WhatsApp) shall be triggered at: dispatched, expected arrival update, and delivered. But **detail level is controlled** — no truck numbers or driver details unless sales team shares manually. | High |

---

## 11. Module 7 — Billing, Invoicing & Tally Integration

### 11.1 Overview

Tally is and will remain the accounting backbone. This module defines how the new system generates invoices, syncs with Tally, and handles the complex billing flows unique to paper trading (two firms, bill interception, weight-based billing, etc.).

### 11.2 Functional Requirements

#### 11.2.1 Invoice Generation

| ID | Requirement | Priority |
|----|------------|----------|
| BL-001 | System shall generate **Sales Invoices** based on confirmed Sales Orders and dispatched quantities. | High |
| BL-002 | Invoice shall be created under the correct firm: **Monit Paper Sales Agency** (for ITC products) or **Monit Paper Associates** (for NR and other mill products) — based on configurable mill-to-firm mapping. | High |
| BL-003 | System shall support **advance billing** — if delivery is confirmed and customer needs the invoice early (e.g., day before dispatch), the accountant can generate the invoice before physical delivery. | High |
| BL-004 | Invoice shall include: customer GSTIN, HSN codes for paper products, applicable GST rates (CGST+SGST or IGST based on inter/intra-state), and paper-specific details (type, GSM, size, quantity in sheets and kgs). | High |
| BL-005 | System shall support **Debit Notes** (for additional charges — freight, rate adjustments upward) and **Credit Notes** (for returns, rate adjustments downward, quality claims, weight shortages). | High |

#### 11.2.2 Tally Synchronization

| ID | Requirement | Priority |
|----|------------|----------|
| BL-010 | System shall provide a **two-way sync bridge with Tally**: (a) Push: invoices, DN/CN generated in the system shall be created in Tally automatically. (b) Pull: payment receipts, ledger balances, and outstanding data shall be pulled from Tally into the system. | Critical |
| BL-011 | Sync shall be **near-real-time** (within 5 minutes) or configurable batch sync (e.g., every 30 minutes). | High |
| BL-012 | Purchase bills (from mills) are entered in Tally by the accountant. System shall pull this data to update procurement records (bill received, amount, etc.). | High |
| BL-013 | Customer payment status (outstanding balance, last payment date, overdue amount) shall be continuously synced from Tally to the system — this data drives the **approval workflow and AI chatbot decisions**. | Critical |
| BL-014 | System shall handle the **firm bifurcation** in Tally — entries for Agency and Associates go to their respective Tally company files. | High |

#### 11.2.3 GST & Tax Compliance

| ID | Requirement | Priority |
|----|------------|----------|
| BL-020 | System shall generate **E-Invoices** as per GST requirements (mandatory for turnover above threshold). | High |
| BL-021 | System shall generate **E-Way Bills** for every dispatch above the threshold value. | High |
| BL-022 | System shall support **GSTR reconciliation** — match purchase register with GSTR-2A/2B for input tax credit validation. | Medium |
| BL-023 | System shall handle **TCS (Tax Collected at Source)** on sales above ₹50 lakh per customer per financial year (applicable to traders). | Medium |

---

## 12. Module 8 — Payment & Credit Management

### 12.1 Overview

Paper trading operates on a unique financial model: mills require 100% advance payment, but dealers extend unsecured credit to customers. Managing this credit exposure is critical to business health.

### 12.2 Functional Requirements

#### 12.2.1 Customer Credit Management

| ID | Requirement | Priority |
|----|------------|----------|
| PM-001 | Each customer shall have a configurable **credit limit** set by the owner — the maximum outstanding amount allowed. | High |
| PM-002 | System shall track **real-time credit utilization**: (credit limit - current outstanding - pending invoices - orders in pipeline) = available credit. | Critical |
| PM-003 | System shall display **credit health indicators** on every customer interaction (order, inquiry, approval screen): credit limit, utilized amount, available credit, oldest overdue invoice, and days overdue. | High |
| PM-004 | Owner shall be able to **temporarily adjust credit limits** — increase during mill-pressure scenarios or decrease for problematic customers — with effective date range and reason. | High |
| PM-005 | System shall categorize customers by payment behavior: "Prompt" (pays within terms), "Slow" (pays 15–30 days late), "Risky" (pays 30+ days late), "Defaulter" (chronic non-payment). This categorization should be auto-calculated and overridable. | Medium |

#### 12.2.2 Payment Tracking

| ID | Requirement | Priority |
|----|------------|----------|
| PM-010 | System shall pull **payment receipt data from Tally** — showing all payments received against invoices. | High |
| PM-011 | System shall track **PDC (Post-Dated Cheques)**: cheque number, date, amount, bank, and status (received, deposited, cleared, bounced). | Medium |
| PM-012 | System shall generate **payment reminders** — automated alerts to the sales team (not directly to customers) when payments are approaching due date or overdue. | High |
| PM-013 | System shall provide an **aging analysis** per customer: current, 30 days, 60 days, 90 days, 120+ days outstanding. | High |
| PM-014 | System shall track **advance payments** — when a customer pays in advance, the credit should reflect positively. | Medium |

#### 12.2.3 Collection Follow-Up

| ID | Requirement | Priority |
|----|------------|----------|
| PM-020 | System shall generate a **daily collection follow-up list** per salesperson — listing their customers with overdue amounts and suggested follow-up actions. | High |
| PM-021 | Salesperson shall log collection follow-up activities: called, visited, promised date, partial payment received, etc. | Medium |
| PM-022 | System shall flag customers whose promised payment dates have passed without payment — escalating these to the owner. | Medium |

---

## 13. Module 9 — Quality, Claims & Returns Management

### 13.1 Overview

Paper quality issues are common — GSM variation, surface defects, moisture damage, burrs from sheeter cutting. This module tracks quality complaints, manages claims with mills, and handles customer returns.

### 13.2 Functional Requirements

| ID | Requirement | Priority |
|----|------------|----------|
| QC-001 | System shall support **quality complaint registration**: customer name, invoice reference, paper details, nature of complaint (GSM mismatch, surface defect, moisture damage, burr, curl, color variation), quantity affected, and photographic evidence upload. | High |
| QC-002 | Complaints shall be categorized: (a) mill manufacturing defect → claim against mill, (b) sheeter cutting defect → internal issue, (c) transit damage → insurance/transporter claim, (d) customer handling → no claim. | High |
| QC-003 | For mill claims, system shall generate a **claim document** to submit to the mill with: complaint details, evidence, affected quantity, and requested resolution (replacement, credit note, rate adjustment). | High |
| QC-004 | System shall track **claim lifecycle**: claim raised → submitted to mill → mill acknowledged → mill investigated → claim accepted/rejected → resolution (CN received / replacement dispatched). | Medium |
| QC-005 | System shall support **customer returns**: material returned by customer due to quality or wrong delivery. Track: return quantity, reason, condition, and resolution (replacement, credit note, stock back to inventory). | High |
| QC-006 | System shall track **quality metrics per mill**: complaint rate, claim acceptance rate, and average resolution time — informing procurement decisions. | Medium |
| QC-007 | System shall manage **weight shortage claims**: when received weight is less than billed weight beyond tolerance, auto-generate a shortage claim to the mill. | High |

---

## 14. Module 10 — Reporting, Analytics & Market Intelligence

### 14.1 Overview

The owner's primary demand: "I want auto-generated reports so I don't have to manually filter Excel." This module provides comprehensive, automated reporting and market intelligence drawn from system data.

### 14.2 Standard Reports

#### 14.2.1 Sales Reports

| ID | Report | Description | Frequency |
|----|--------|-------------|-----------|
| RP-001 | **Sales Summary** | Total sales by firm, mill, product category, customer — with comparison to previous period | Daily/Weekly/Monthly |
| RP-002 | **Salesperson Performance** | Orders booked, revenue generated, inquiries handled, conversion rate per salesperson | Weekly/Monthly |
| RP-003 | **Customer-Wise Sales** | Revenue per customer, product mix, average order size, order frequency | Monthly |
| RP-004 | **Mill-Wise Sales** | How much of each mill's product was sold, margin analysis per mill | Monthly |
| RP-005 | **Product-Wise Sales** | Which paper types, GSMs, and sizes are selling most — trend analysis | Monthly |

#### 14.2.2 Procurement Reports

| ID | Report | Description | Frequency |
|----|--------|-------------|-----------|
| RP-010 | **Pending Orders** | All open POs with mills — status, expected dates, and overdue flags | Daily |
| RP-011 | **Mill Performance Scorecard** | TAT adherence, weight accuracy, quality rating per mill | Monthly |
| RP-012 | **Procurement Cost Analysis** | Buying prices trend, margin analysis, scheme/incentive utilization | Monthly |

#### 14.2.3 Inventory Reports

| ID | Report | Description | Frequency |
|----|--------|-------------|-----------|
| RP-020 | **Stock Position** | Current stock by location, type, GSM, size — with status breakdown (AVL/BKD/TRN/etc.) | Real-time/Daily |
| RP-021 | **Stock Aging** | Items in stock for >30, >60, >90 days — slow-moving inventory identification | Weekly |
| RP-022 | **Stock Turnover** | How fast each product category moves — days of inventory on hand | Monthly |
| RP-023 | **Sheeter Output Report** | Reel consumption, sheets produced, trim waste generated, waste % | Daily/Weekly |

#### 14.2.4 Financial Reports

| ID | Report | Description | Frequency |
|----|--------|-------------|-----------|
| RP-030 | **Receivables Aging** | Outstanding amounts by customer, age-bucketed (current, 30, 60, 90, 120+ days) | Daily |
| RP-031 | **Collection Report** | Payments received today, this week, this month — vs. dues | Daily/Weekly |
| RP-032 | **Margin Analysis** | Per-transaction margin, per-customer margin, per-mill margin | Monthly |
| RP-033 | **Credit Utilization** | How much of allocated credit each customer is using | Real-time |

#### 14.2.5 Follow-Up & CRM Reports

| ID | Report | Description | Frequency |
|----|--------|-------------|-----------|
| RP-040 | **Mill-Wise Customer Follow-Up** | Per mill: which customers haven't been contacted in X days, what they typically buy, last order date — the key report the owner wants automated | Daily |
| RP-041 | **Inquiry Response Time** | Average time to respond to inquiries by channel and salesperson | Weekly |
| RP-042 | **Lost Inquiry Analysis** | Inquiries that didn't convert — reasons, patterns, which customers are only taking rates but ordering elsewhere | Monthly |
| RP-043 | **Customer Visit Tracker** | Which customers were visited, when, by whom, what was discussed | Weekly |

### 14.3 Market Intelligence (from App/Chatbot Data)

| ID | Requirement | Priority |
|----|------------|----------|
| RP-050 | System shall analyze **app search patterns**: what paper types/sizes/GSMs are being searched most frequently — indicating market demand. | High |
| RP-051 | System shall identify **unmet demand**: searches for products Monit doesn't stock or sizes not available — opportunity to add to inventory. | High |
| RP-052 | System shall track **inquiry-to-order drop-off**: customer searched → found available → didn't order. Why? (Price comparison? Testing the system? Urgency mismatch?) | High |
| RP-053 | System shall analyze **competitor intelligence indicators**: if a regular customer's order volume drops, or if they search but don't buy, it may indicate they're sourcing from competitors (like Hansal). Flag for salesperson attention. | Medium |
| RP-054 | System shall provide a **demand forecasting view** — based on historical order data, seasonal patterns, and search trends, predict demand for the next 2–4 weeks by product category. | Medium |

---

## 15. Module 11 — CRM & Customer Relationship Management

### 15.1 Overview

While the system automates many interactions, the business insists on maintaining personal relationships. This module supports the sales team in managing customer relationships systematically.

### 15.2 Functional Requirements

| ID | Requirement | Priority |
|----|------------|----------|
| CR-001 | System shall maintain a **customer master** with: company name, GST details, contact persons (multiple), delivery addresses (multiple), communication preferences, and relationship history. | High |
| CR-002 | Each customer shall have an assigned **primary salesperson** — all system notifications for that customer go to this salesperson first. | High |
| CR-003 | System shall support **customer segmentation/tiering**: Platinum (top volume), Gold, Silver, Bronze — with tier-based service levels (response time SLA, credit terms, pricing priority). | Medium |
| CR-004 | System shall maintain a **customer interaction log**: every call, visit, inquiry, order, complaint — a 360° timeline view. | High |
| CR-005 | System shall generate **automated follow-up reminders** for the sales team: "Customer [X] hasn't ordered in [Y] days — they usually order every [Z] days. Follow up." | High |
| CR-006 | System shall support **sales visit planning**: salesperson logs planned visits, system shows nearby customers who also need a visit, optimizing the day's route. | Low |
| CR-007 | System shall support **sample tracking**: when samples are sent to a customer (for a new product or mill), track: what was sent, when, follow-up date, and outcome (ordered, rejected, no response). | Medium |
| CR-008 | System shall maintain a **customer product preference map**: for each customer, which paper types, GSMs, sizes, and mills they regularly buy — used by both AI chatbot and sales team. | High |

---

## 16. Module 12 — Configuration & Master Data

### 16.1 Overview

The system must be highly configurable — the owner insists on being able to adjust rules and settings without requiring code changes. "The system should be the expert."

### 16.2 Master Data

| ID | Master | Key Fields |
|----|--------|------------|
| MD-001 | **Paper Type Master** | Type (Duplex, FBB, SBS, Kraft, etc.), sub-type (Grey Back, White Back), HSN code, GST rate |
| MD-002 | **GSM Master** | Available GSM values per paper type |
| MD-003 | **Size Master** | Standard sheet sizes (23x36, 25x36, 18x23, etc.) and reel deckle widths |
| MD-004 | **Mill Master** | Mill name, location, products, TAT defaults, payment terms, contact details |
| MD-005 | **Customer Master** | (See CRM module — CR-001) |
| MD-006 | **Transporter Master** | Name, vehicles, rates, service areas |
| MD-007 | **Location/Godown Master** | Address, capacity, type (warehouse, retail point) |
| MD-008 | **Box Type Master** | Carton types for planning engine (reverse tuck-in, lock bottom, etc.) ~20-40 types |
| MD-009 | **Die Master** | Existing dies — dimensions, box type, customer, and usage count |
| MD-010 | **Firm Master** | Agency and Associates details, GST registration, bank accounts — for correct invoicing |

### 16.3 Configuration Settings

| ID | Setting | Description |
|----|---------|-------------|
| CF-001 | **Credit limit defaults** | Default credit limit for new customers by tier |
| CF-002 | **Approval thresholds** | At what credit utilization % to escalate (e.g., >90%) |
| CF-003 | **Stock lock timeout** | How long a soft-lock on stock lasts before auto-release (e.g., 2 hours) |
| CF-004 | **Inquiry response SLA** | Max time to respond to an inquiry before escalation (e.g., 5 min for app, 30 min for WhatsApp) |
| CF-005 | **Weight tolerance** | Acceptable weight discrepancy % before flagging (e.g., 0.5%) |
| CF-006 | **Mill-to-Firm mapping** | Which mill's products are billed through which firm |
| CF-007 | **Minimum margin rules** | Minimum acceptable margin % per product category — below this, price approval required |
| CF-008 | **TAT settings** | Per mill, per product, per category — default and special-run TATs |
| CF-009 | **Customer qualification flags** | Which customers are "marked/qualified" for auto-order processing |
| CF-010 | **Stock visibility rules** | Which items to show, hide, or restrict on customer-facing app |
| CF-011 | **Notification templates** | Configurable message templates for WhatsApp, email, and app notifications |
| CF-012 | **Chatbot escalation rules** | When the chatbot should hand off to a human — configurable triggers |

---

## 17. Non-Functional Requirements

### 17.1 Performance

| ID | Requirement |
|----|------------|
| NF-001 | Stock availability check shall return results in < 2 seconds. |
| NF-002 | AI chatbot shall respond to customer queries in < 5 seconds. |
| NF-003 | Dashboard and reports shall load in < 3 seconds. |
| NF-004 | System shall support at least 50 concurrent internal users and 500 concurrent customer app users. |
| NF-005 | Tally sync shall complete within 5 minutes of transaction. |

### 17.2 Availability & Reliability

| ID | Requirement |
|----|------------|
| NF-010 | System shall have 99.5% uptime during business hours (9:30 AM – 7:00 PM IST, Mon–Sat). |
| NF-011 | Data backup shall occur daily with a 30-day retention period. |
| NF-012 | System shall support graceful degradation — if Tally sync is down, core operations continue with last-known data. |

### 17.3 Security

| ID | Requirement |
|----|------------|
| NF-020 | All user access shall be authenticated (username/password + OTP for sensitive actions). |
| NF-021 | Role-based access control as defined in Section 3. |
| NF-022 | All API communication shall use HTTPS/TLS encryption. |
| NF-023 | Customer financial data (credit limits, outstanding) shall never be visible to customers. |
| NF-024 | Sensitive operations (credit limit change, manual override, stock hide) shall have audit logs. |
| NF-025 | Customer app shall not cache sensitive business data on the device. |

### 17.4 Scalability

| ID | Requirement |
|----|------------|
| NF-030 | System shall be designed to accommodate growth from current ~100 active customers to 500+ over 3 years. |
| NF-031 | Additional mills, products, and locations shall be addable via configuration without code changes. |
| NF-032 | Report generation shall remain performant as data grows (partitioning strategy for historical data). |

### 17.5 Usability

| ID | Requirement |
|----|------------|
| NF-040 | Internal web interface shall be usable by non-technical staff with minimal training (warehouse staff, accountant). |
| NF-041 | Customer app shall have a simple, intuitive search interface — no more than 3 taps to check availability. |
| NF-042 | System shall support Hindi and English for internal interfaces. |
| NF-043 | Customer-facing chatbot shall support Hindi and English (and ideally Hinglish — mixed). |
| NF-044 | All critical actions shall have confirmation dialogs to prevent accidental operations. |

### 17.6 Data Migration

| ID | Requirement |
|----|------------|
| NF-050 | Existing customer data (from Excel databases) shall be migrated to the new system. |
| NF-051 | Existing stock data (from Google Sheets) shall be migrated. |
| NF-052 | Historical order data (if available in Tally) shall be imported for reporting baseline. |
| NF-053 | Customer product preference data (currently in owner's personal knowledge/notes) shall be captured and digitized during setup. |

---

## 18. Business Rules Engine

### 18.1 Overview

The owner explicitly wants business rules to be configurable, not hardcoded: "The system should be the expert, not the person." The rules engine evaluates conditions and drives automated decisions across modules.

### 18.2 Rule Categories

#### 18.2.1 Credit & Payment Rules

| Rule ID | Rule | Action |
|---------|------|--------|
| BR-001 | Credit utilization > 100% | Block order, escalate to Owner |
| BR-002 | Credit utilization > 90% (configurable) | Flag for owner review, two-step approval |
| BR-003 | Overdue > 30 days (configurable) | Warn salesperson, require owner approval for new orders |
| BR-004 | Overdue > 60 days | Auto-flag customer as "Watch"; chatbot responds with "let me check" |
| BR-005 | Customer marked as "Blocked" | No orders accepted; chatbot says "connect with sales team" |
| BR-006 | Advance payment received | Credit restored, order can proceed |

#### 18.2.2 Stock & Availability Rules

| Rule ID | Rule | Action |
|---------|------|--------|
| BR-010 | Stock available and customer rules pass | Show "Available" immediately |
| BR-011 | Stock available but customer rules fail (soft) | Show "Checking availability…" → escalate internally |
| BR-012 | Stock available but customer rules fail (hard) | Show "Let me connect you with the team" → escalate |
| BR-013 | Stock not available | Show "Not Available" with alternatives |
| BR-014 | Partial stock available | Show "Partially Available" with timeline for remainder |
| BR-015 | Stock reserved by another salesperson | Show "Currently booked" to second salesperson with alternatives |

#### 18.2.3 Pricing Rules

| Rule ID | Rule | Action |
|---------|------|--------|
| BR-020 | Selling price < minimum margin threshold | Block sale, require owner approval |
| BR-021 | Stock lot material | Apply stock lot pricing; allow cross-selling as lower GSM if beneficial |
| BR-022 | Customer rate card expired | Alert salesperson to renegotiate |

#### 18.2.4 Operational Rules

| Rule ID | Rule | Action |
|---------|------|--------|
| BR-030 | Material in transit > expected arrival + 2 days | Alert procurement team; update customer ETAs |
| BR-031 | Weight discrepancy > tolerance on receipt | Auto-create shortage claim |
| BR-032 | Customer inquiry not responded within SLA | Escalate to sales manager |
| BR-033 | Customer hasn't ordered in > X days (configurable per tier) | Auto-generate follow-up reminder |

### 18.3 Situational Override

| ID | Requirement | Priority |
|----|------------|----------|
| BR-040 | Owner shall have a **"Mill Pressure Mode"** toggle: when activated, it temporarily relaxes credit limits by a configurable percentage for a configurable duration. This handles the scenario where excess stock needs to be moved urgently. | High |
| BR-041 | All overrides shall be **logged with reason and duration** — the system reverts to normal rules automatically after the override period expires. | High |
| BR-042 | Owner shall be able to create **ad-hoc rules** for specific situations: e.g., "For customer X, allow 150% credit for the next 7 days because they have a large job and will pay after completion." | Medium |

---

## 19. Integration Requirements

### 19.1 Integration Map

```
┌──────────────────────────────────────────────────────┐
│              MONIT TRADING SYSTEM                     │
│                                                      │
│  ┌──────────────────────────────────────────────┐    │
│  │           INTERNAL MODULES                    │    │
│  │  Purchase│Inventory│Sales│Dispatch│Reports   │    │
│  └─────┬────────┬───────┬──────┬────────┬───────┘    │
│        │        │       │      │        │            │
├────────┼────────┼───────┼──────┼────────┼────────────┤
│        │        │       │      │        │            │
│  ┌─────▼──┐ ┌───▽───┐ ┌▽────┐ ┌▽─────┐ ┌▽─────────┐ │
│  │ Tally  │ │Plann. │ │WA   │ │E-Way │ │Email     │ │
│  │ Bridge │ │Engine │ │Biz  │ │Bill  │ │Service   │ │
│  │        │ │API    │ │API  │ │API   │ │(SMTP)    │ │
│  └────────┘ └───────┘ └─────┘ └──────┘ └──────────┘ │
└──────────────────────────────────────────────────────┘
```

### 19.2 Integration Details

| # | System | Direction | Data Exchanged | Method | Priority |
|---|--------|-----------|----------------|--------|----------|
| 1 | **Tally ERP** | Bi-directional | Invoices, payments, ledger balances, purchase bills, DN/CN | Tally API / XML bridge | Critical |
| 2 | **Planning Engine (Sheeter App)** | Outbound call | Box dimensions, machine size → Optimal sheet sizes, plans | REST API | High |
| 3 | **WhatsApp Business API** | Bi-directional | Customer messages, chatbot responses, notifications, order confirmations | WhatsApp Cloud API | High |
| 4 | **E-Way Bill Portal** | Outbound | Invoice details → E-Way Bill generation | GST E-Way Bill API | High |
| 5 | **E-Invoice Portal (IRP)** | Outbound | Invoice details → E-Invoice IRN generation | GST E-Invoice API | High |
| 6 | **Email (SMTP)** | Outbound | PO to mills, order confirmations, internal notifications | SMTP/Email API | Medium |
| 7 | **SMS Gateway** | Outbound | OTP, critical alerts | SMS API | Low |
| 8 | **ITC Portal** (Future) | Inbound | Order status updates, dispatch details | Web scraping / API (if available) | Future |

---

## 20. Data Model Overview

### 20.1 Core Entities

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│  CUSTOMER   │────<│  INQUIRY    │────>│  SALES ORDER │
│             │     │             │     │              │
│ • name      │     │ • date      │     │ • SO number  │
│ • tier      │     │ • product   │     │ • firm       │
│ • credit    │     │ • quantity  │     │ • status     │
│   limit     │     │ • channel   │     │ • pricing    │
│ • machines  │     │ • status    │     │ • fulfillment│
│ • addresses │     │ • salesman  │     │   source     │
└──────┬──────┘     └─────────────┘     └──────┬───────┘
       │                                       │
       │            ┌─────────────┐            │
       └───────────>│  PAYMENT    │<───────────┘
                    │             │
                    │ • invoice # │    ┌──────────────┐
                    │ • amount    │    │   DISPATCH   │
                    │ • due date  │    │              │
                    │ • status    │    │ • truck      │
                    └─────────────┘    │ • status     │
                                      │ • bill swap  │
┌─────────────┐     ┌─────────────┐   └──────────────┘
│    MILL     │────<│PURCHASE ORDER│
│  (Supplier) │     │             │    ┌──────────────┐
│             │     │ • PO number │    │  INVENTORY   │
│ • products  │     │ • mill      │    │              │
│ • TAT       │     │ • status    │    │ • location   │
│ • pricing   │     │ • delivery  │    │ • product    │
│ • schemes   │     │   date      │    │ • status     │
└─────────────┘     └──────┬──────┘    │ • quantity   │
                           │           │ • reserved   │
                           └──────────>│   for        │
                                       └──────────────┘

┌─────────────┐     ┌─────────────┐    ┌──────────────┐
│   PRODUCT   │     │  SHEETER    │    │   QUALITY    │
│             │     │   JOB       │    │   CLAIM      │
│ • type      │     │             │    │              │
│ • GSM       │     │ • reel in   │    │ • type       │
│ • size      │     │ • sheets out│    │ • status     │
│ • mill      │     │ • trim waste│    │ • resolution │
└─────────────┘     └─────────────┘    └──────────────┘
```

### 20.2 Key Relationships

1. **Customer ↔ Inquiry** — One customer, many inquiries.
2. **Inquiry → Sales Order** — One inquiry may become one SO (or none, if not converted).
3. **Sales Order → Purchase Order** — One SO may trigger one or more POs (if stock not available).
4. **Sales Order → Dispatch** — One SO may have multiple dispatches (partial fulfillment).
5. **Purchase Order → Inventory** — PO receipt adds to inventory.
6. **Sales Order → Inventory** — SO fulfillment deducts from inventory (with reservation).
7. **Inventory → Sheeter Job** — Reel inventory consumed by sheeter jobs, producing sheet inventory.
8. **Sales Order → Invoice → Payment** — Standard billing chain, synced with Tally.
9. **Mill → Products** — Each mill manufactures specific products with specific TATs.
10. **Customer → Credit** — Each customer has credit terms driving the approval engine.

---

## 21. Phased Rollout Plan

Based on the owner's priority ("fix procurement first"), the following phased approach is recommended:

### Phase 1 — Foundation & Procurement (Months 1–3)

**Focus:** Replace Excel/Word-based procurement with a structured system.

| Deliverable | Description |
|-------------|-------------|
| Master Data Setup | Mill, product, customer, and location masters |
| Purchase Order Module | Order form, PO generation (PDF), email to mill |
| Pending Order Tracking | Status tracking, delivery date management, follow-up alerts |
| Material Receipt | Transit tracking, godown receipt, weight reconciliation |
| Basic Inventory | Multi-location stock tracking with 5 statuses |
| Tally Bridge (Phase 1) | Pull payment/outstanding data from Tally |
| Internal Dashboards | Procurement dashboard, pending orders, stock position |

### Phase 2 — Sales & Internal Operations (Months 3–5)

**Focus:** Digitize sales workflow, enable stock reservation, and connect sales to procurement.

| Deliverable | Description |
|-------------|-------------|
| Inquiry Management | Inquiry capture, assignment, tracking |
| Sales Order Workflow | SO creation, confirmation, fulfillment tracking |
| Stock Reservation | Real-time soft-locking to prevent salesman conflicts |
| Approval Workflow | Rule-based order approval with multi-level escalation |
| Dispatch Planning | Load planning, bill interception workflow, delivery tracking |
| Tally Bridge (Phase 2) | Push invoices to Tally, pull updated payment data |
| Sales Reports | Salesperson performance, customer follow-up, conversion rates |

### Phase 3 — Customer-Facing App & AI Chatbot (Months 5–8)

**Focus:** Launch the customer-facing experience — the "game changer."

| Deliverable | Description |
|-------------|-------------|
| Customer Mobile App | Registration, search, availability check, order placement, order tracking |
| AI Chatbot (App) | Conversational availability check, alternative suggestions, inquiry/order flow |
| WhatsApp Chatbot | Same chatbot capabilities via WhatsApp Business API |
| Planning Engine Integration | Carton dimension input → optimal sheet size recommendation |
| Customer Profile | Machine sizes, preferences, qualification flags |
| Hidden Rule Engine | Silent credit/payment checks with diplomatic responses |
| Market Intelligence | Search analytics, demand tracking, competitor indicators |

### Phase 4 — Advanced Features & Optimization (Months 8–12)

**Focus:** Refine, optimize, and add advanced capabilities.

| Deliverable | Description |
|-------------|-------------|
| Credit Management | Full credit lifecycle, PDC tracking, collection follow-up |
| Quality & Claims | Complaint registration, mill claims, returns management |
| Advanced Reporting | Demand forecasting, mill performance scorecards, margin analysis |
| Mill Scheme Tracking | Incentive programs, target achievement alerts |
| CRM Enhancements | Visit planning, sample tracking, customer journey analytics |
| AI Improvements | Learning from interaction data, better recommendations, proactive suggestions |
| GST Compliance | E-Invoice, E-Way Bill automation, GSTR reconciliation |

---

## 22. Appendices

### Appendix A — Mill Portfolio

| Mill | Products | Firm | Typical TAT |
|------|----------|------|-------------|
| ITC Limited (PSPD) | FBB, SBS, Coated, Packaging Board | Monit Paper Sales Agency | 3–7 days (nearby) |
| NR Agarwal Industries | Duplex Board (Grey Back, White Back), Kraft | Monit Paper Associates | 4–10 days (Vapi) |
| Gayatri Shakti Paper | Duplex Board, Kraft | Associates | 5–12 days |
| Emami Paper Mills | Writing/Printing, Packaging Board | Associates | 7–15 days |
| Balkrishna Paper Mills | Duplex Board | Associates | 5–10 days |
| JK Paper Ltd | FBB, Writing/Printing | Agency/Associates | 5–15 days |
| Others (6-7 mills) | Various | As configured | Variable |

### Appendix B — Product Catalog Structure

| Paper Type | Sub-Types | Common GSM Range | Common Sizes |
|-----------|-----------|-----------------|--------------|
| Duplex Board | Grey Back (GBD), White Back (WBD) | 200–450 GSM | 23x36, 25x36, 28x36, custom |
| FBB (Folding Box Board) | Standard, Premium | 210–400 GSM | 23x36, 25x36, 22x28 |
| SBS (Solid Bleached Sulfate) | Standard | 200–350 GSM | Various |
| Kraft Paper | Brown, White | 80–300 GSM | Reel and sheet |
| Coated Paper | C1S, C2S | 80–300 GSM | Various |

### Appendix C — Operating Hours & SLA Expectations

| Parameter | Value |
|-----------|-------|
| Business Hours | Mon–Fri 9:30 AM – 7:00 PM, Sat 9:30 AM – 5:30 PM |
| App/Chatbot Availability | 24/7 (automated responses outside business hours) |
| Inquiry Response SLA (App) | < 5 minutes |
| Inquiry Response SLA (WhatsApp/Phone) | < 30 minutes |
| Order Approval SLA | < 1 hour during business hours |
| Dispatch After Approval | Same day (if stock available and billing done) |

### Appendix D — Glossary of Customer-Facing Diplomatic Responses

| Internal Situation | Customer-Facing Response |
|-------------------|-------------------------|
| Stock available, all rules pass | "Available! Would you like to order?" |
| Stock available, credit issue (soft) | "Let me check if this is already booked… one moment." |
| Stock available, credit issue (hard) | "Let me connect you with our sales team for this one." |
| Stock not available | "Not available currently. Here are alternatives: [list]" |
| Stock partially available | "Partially available now. Rest can be arranged in [X] days." |
| Customer blocked | "I'll have the team reach out to you shortly." |
| After owner approves (from escalation) | "Great news — it's available! Shall I proceed with the order?" |
| After owner rejects (from escalation) | "This batch is committed to another order. Our sales team will contact you with options." |

### Appendix E — Additional Paper Trading Activities (Industry Standard)

The following activities are standard in the paper trading industry and are incorporated across the relevant modules of this SRS:

| # | Activity | Covered In Module |
|---|----------|------------------|
| 1 | Weight Reconciliation (mill vs. actual) | Procurement (PR-033) |
| 2 | Quality Claims & Returns | Quality & Claims (Module 9) |
| 3 | Sample Management (sending paper samples to prospects) | CRM (CR-007) |
| 4 | Debit Note / Credit Note Management | Billing (BL-005) |
| 5 | Mill Commission & Incentive Tracking | Procurement (PR-006) |
| 6 | Freight & Transport Cost Management | Dispatch (DL-020 to DL-022) |
| 7 | GST / E-Way Bill / E-Invoice Compliance | Billing (BL-020 to BL-023) |
| 8 | Payment Collection & PDC Management | Payment (Module 8) |
| 9 | Customer Segmentation & Tiering | CRM (CR-003) |
| 10 | Price List & Margin Management | Sales (SL-010 to SL-015) |
| 11 | Sheeter Trim/Waste Management | Inventory (IN-020 to IN-024) |
| 12 | Multi-Location Godown Management | Inventory (IN-001 to IN-004) |
| 13 | Transit & Stock Insurance Claims | Quality & Claims (QC-002) |
| 14 | Seasonal Demand Forecasting | Reporting (RP-054) |
| 15 | Competitor Price Intelligence | Reporting (RP-053) |
| 16 | Sales Team Visit/Activity Tracking | CRM (CR-006) |
| 17 | Mill Scheme Pass-through to Customers | Procurement (PR-006) |
| 18 | Stock Lot / Seconds Material Management | Inventory (IN-030 to IN-032) |
| 19 | Reel Inventory & Conversion Tracking | Inventory (IN-020 to IN-024) |
| 20 | Customer Machine Profile Management | Customer App (CA-050 to CA-052) |
| 21 | Die Library Management | Configuration (MD-009) |
| 22 | Inter-Godown Stock Transfers | Inventory (IN-003) |
| 23 | Mill Run Broadcast & Proactive Sales | Sales (SL-006) |
| 24 | Advance Payment from Mills (100% advance model) | Payment (PM-014) |
| 25 | Unsecured Credit Risk Management | Payment (PM-001 to PM-005) |

---

## Appendix F — Implementation Status

**Phase 1 — Admin Panel Frontend Prototype: Complete (2026-02-19)**
**Phase 1 — Backend API Integration: In Progress (as of 2026-05-19)**

Frontend prototype is fully implemented. Backend (.NET 8 + Dapper + SQL Server) is built and the majority of core modules are API-integrated. Remaining pages still use TypeScript mock data (`/data/mockData.ts`).

### F.1 Tech Stack

| Layer     | Technology                       |
|-----------|----------------------------------|
| Framework | Next.js 16 (App Router)          |
| Language  | TypeScript                       |
| Styling   | Tailwind CSS v4                  |
| Charts    | Recharts                         |
| Icons     | Lucide React                     |
| Backend   | .NET 8 Web API + Dapper + MSSQL  |
| Auth      | JWT Bearer + BCrypt + HttpOnly refresh cookie |

### F.2 Implemented Pages & Routes

#### Dashboards

| Route                   | Status    | Description                                              |
|-------------------------|-----------|----------------------------------------------------------|
| `/`                     | ✅ Done   | Owner Dashboard — KPIs, sales trend, order pipeline, payment status |
| `/dashboard/accounts`   | ✅ Done   | Accounts Dashboard — invoice stats, monthly chart, payment pie, receivables aging |
| `/dashboard/salesman`   | ✅ Done   | Salesman Dashboard — performance comparison, skill radar, per-salesman cards |
| `/dashboard/planner`    | ✅ Done   | Planner Dashboard — truck load pipeline, mill order status, warehouse stock |

#### Sales Workflow

| Route        | UI Status | API Status | Description                                         |
|--------------|-----------|------------|-----------------------------------------------------|
| `/inquiry`   | ✅ Done   | 🔲 Pending | Customer Inquiry — capture, assign, track           |
| `/orders`    | ✅ Done   | ✅ Live    | Sales Orders — create, track, allocate, dispatch    |
| `/coverage`  | ✅ Done   | 🔲 Pending | Coverage / customer territory map view              |
| `/customers` | ✅ Done   | ✅ Live    | Customer Master                                     |

#### Procurement & Logistics

| Route               | UI Status | API Status | Description                                                  |
|---------------------|-----------|------------|--------------------------------------------------------------|
| `/purchase-orders`  | ✅ Done   | ✅ Live    | Purchase Orders to mills — create, track, status updates     |
| `/mill-tracker`     | ✅ Done   | ✅ Live    | Mill Order Tracker — PO-line progress with production status |
| `/truck-load-plan`  | ✅ Done   | ✅ Live    | Truck Load Planner — group orders into truck loads           |
| `/dispatch-queue`   | ✅ Done   | 🔲 Pending | Dispatch Queue — orders ready for dispatch                   |
| `/in-transit`       | ✅ Done   | 🔲 Pending | In-Transit tracking                                          |
| `/grn`              | ✅ Done   | ✅ Live    | GRN — record material arriving at godown                     |
| `/challan`          | ✅ Done   | 🔲 Pending | Challan & Loading — delivery challans                        |
| `/pick-plan`        | ✅ Done   | 🔲 Pending | Pick Plan (FIFO + Bin) — warehouse picking instructions      |
| `/bin-locations`    | ✅ Done   | ✅ Live    | Bin Location Master                                          |

#### Invoice Tracker

| Route                | Status    | Description                      |
|----------------------|-----------|----------------------------------|
| `/purchase-invoices` | ✅ Done   | Purchase Invoices from mills     |
| `/sales-invoices`    | ✅ Done   | Sales Invoices to customers      |

#### Reports (15 pages)

| Route                                                      | Status    |
|------------------------------------------------------------|-----------|
| `/reports/sales-performance/sales-summary`                 | ✅ Done   |
| `/reports/sales-performance/customer-wise-volume`          | ✅ Done   |
| `/reports/sales-performance/product-wise-sales`            | ✅ Done   |
| `/reports/sales-performance/quality-wise-sales-trend`      | ✅ Done   |
| `/reports/sales-performance/salesman-performance`          | ✅ Done   |
| `/reports/sales-performance/target-vs-order-lifted`        | ✅ Done   |
| `/reports/sales-performance/inquiry-conversion-funnel`     | ✅ Done   |
| `/reports/mill-supply/mill-performance`                    | ✅ Done   |
| `/reports/mill-supply/product-against-supply`              | ✅ Done   |
| `/reports/mill-supply/customer-order-by-mill`              | ✅ Done   |
| `/reports/mill-supply/product-ready-vs-transport-delay`    | ✅ Done   |
| `/reports/logistics-transport/transporter-performance`     | ✅ Done   |
| `/reports/logistics-transport/in-transit-delay-report`     | ✅ Done   |
| `/reports/finance-inventory/customer-aging`                | ✅ Done   |
| `/reports/finance-inventory/inventory-report`              | ✅ Done   |

All report pages include: search/filter bar, column visibility toggle, and CSV export.

#### Masters

| Route                  | Status    | Description                            |
|------------------------|-----------|----------------------------------------|
| `/masters/materials`   | ✅ Done   | Material Master — paper types, GSM     |
| `/masters/categories`  | ✅ Done   | Category Master                        |
| `/masters/mills`       | ✅ Done   | Mill Master — mill details, TAT        |
| `/masters/salesmen`    | ✅ Done   | Salesman Master — territory, targets   |
| `/masters/warehouse`   | ✅ Done   | Warehouse / Godown Master              |
| `/masters/transporters`| ✅ Done   | Transporter Master                     |
| `/masters/rates`       | ✅ Done   | Rate Master — customer-wise price cards|

#### Settings

| Route             | Status    | Description                                        |
|-------------------|-----------|----------------------------------------------------|
| `/settings`       | ✅ Done   | App Settings — Company, Notifications, Security, Tally |
| `/settings/users` | ✅ Done   | User Management — add/edit/delete, assign roles    |
| `/settings/roles` | ✅ Done   | Role Management — define roles, permission matrix  |
| `/settings/teams` | ✅ Done   | Team Management — organize users, assign territories|

### F.3 Shared Components

| Component                            | Description                                                     |
|--------------------------------------|-----------------------------------------------------------------|
| `components/Sidebar.tsx`             | Responsive sidebar with collapsible sections and active state   |
| `components/Header.tsx`              | Top bar with breadcrumb navigation                              |
| `components/DataGrid.tsx`            | Reusable table with sort, filter, column toggle, CSV export     |
| `components/reports/ReportPageLayout.tsx` | Report page wrapper — search, filters, column toggle, CSV  |

### F.4 Remaining Backend Integration (Phase 1)

| Item                              | Description                                                   |
|-----------------------------------|---------------------------------------------------------------|
| Customer Inquiry API              | CRUD + check-coverage + convert-to-SO                         |
| Coverage Engine API               | Stock + in-transit coverage query                             |
| Pick Plan API                     | FIFO auto-generation + confirm picked                         |
| Challan API                       | Create from TLP + issue action                                |
| In-Transit API                    | Status updates + arrival confirmation                         |
| Notifications API                 | List, mark-read, dismiss                                      |
| Report APIs                       | Aggregation queries for all 15 report pages                   |
| Dashboard API                     | KPI aggregates (partially done)                               |

### F.5 Phase 2 — Future

| Item                              | Description                                                   |
|-----------------------------------|---------------------------------------------------------------|
| Invoicing                         | Sales Invoices, Purchase Invoices, Payments                   |
| Tally Sync Bridge                 | Real-time or near-real-time sync with Tally ERP               |
| Customer-Facing App               | Mobile app + AI chatbot (WhatsApp + in-app)                   |
| Planning Engine Integration       | Carton optimization API hookup                                |
| Real-time Notifications           | WebSocket / push notifications for order/dispatch events      |
| E-Way Bill & GST Compliance       | API integration for e-invoice and e-way bill generation       |

---

*End of SRS Document — Version 1.2*

*This document is subject to review and approval by the Monit Paper Agency management team. Requirements may be refined during the detailed design phase.*
