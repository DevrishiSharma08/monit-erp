"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, ShoppingCart, Truck, ShoppingBag, Database,
  Box, Factory, MapPin, PanelLeftClose, PanelLeftOpen,
  X, MessageSquare, ClipboardCheck, Shield, Star, ChevronRight,
  ChevronDown, Tag, IndianRupee, Settings, Package,
  Layers, LayoutGrid, ThumbsUp, Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";

// ─── Types ────────────────────────────────────────────────────────────────────

interface NavLeaf {
  type: "leaf";
  name: string;
  href: string;
  icon: React.ElementType;
  perm?: string;
}

interface NavSubGroup {
  type: "subgroup";
  label: string;
  items: NavLeaf[];
  perm?: string;
}

interface NavSection {
  type: "section";
  name: string;
  icon: React.ElementType;
  items: (NavLeaf | NavSubGroup)[];
  perm?: string;
}

type TopItem = NavLeaf | NavSection;

// ─── Navigation config — Phase 1 (Procurement Flow) ─────────────────────────
// Phase 2 (Sales) and Phase 3 (Dashboards/Reports) items are commented out below.
// Re-enable them when those phases begin.

const NAV_ADMIN: TopItem[] = [
  // ── Phase 1 ──────────────────────────────────────────────────────────────
  { type: "leaf", name: "Dashboard",          href: "/",                icon: LayoutDashboard, perm: "dashboard.read" },
  { type: "leaf", name: "Sales Order",        href: "/orders",          icon: ShoppingCart,    perm: "so.read"        },
  { type: "leaf", name: "Approvals",          href: "/approvals",       icon: ThumbsUp,        perm: "approvals.read" },
  { type: "leaf", name: "Purchase Order",     href: "/purchase-orders", icon: ShoppingBag,     perm: "po.read"        },
  { type: "leaf", name: "Mill Order Tracker", href: "/mill-tracker",    icon: Factory,         perm: "mill.read"      },
  { type: "leaf", name: "Truck Load Planner", href: "/truck-load-plan", icon: Truck,           perm: "logistics.read" },
  { type: "leaf", name: "GRN",                href: "/grn",             icon: ClipboardCheck,  perm: "grn.read"       },
  { type: "leaf", name: "Stock Location",     href: "/stock-lots",      icon: Package,         perm: "stock.read"     },
  {
    type: "section",
    name: "Masters",
    icon: Database,
    perm: "masters.read",
    items: [
      { type: "leaf", name: "Item Type",           href: "/masters/item-type",      icon: LayoutGrid    },
      { type: "leaf", name: "Mill Master",         href: "/masters/mills",          icon: Factory       },
      { type: "leaf", name: "Quality Master",      href: "/masters/categories",     icon: Layers        },
      { type: "leaf", name: "HSN Master",          href: "/masters/hsn",            icon: Tag           },
      { type: "leaf", name: "Item Master",         href: "/masters/materials",      icon: Box           },
      { type: "leaf", name: "Rate Master",         href: "/masters/rates",          icon: IndianRupee   },
      { type: "leaf", name: "Locality Master",     href: "/masters/localities",     icon: MapPin        },
      { type: "leaf", name: "Customer Master",     href: "/masters/customers",      icon: Users         },
      { type: "leaf", name: "Transporter Master",  href: "/masters/transporters",   icon: Star          },
      { type: "leaf", name: "Warehouse Master",    href: "/masters/warehouse",      icon: MapPin        },
      { type: "leaf", name: "Instruction Master",  href: "/masters/instructions",   icon: MessageSquare },
    ],
  },
  {
    type: "section",
    name: "Settings",
    icon: Settings,
    items: [
      { type: "leaf", name: "Company Settings", href: "/settings/company", icon: Building2, perm: "company.read" },
      { type: "leaf", name: "User Management",  href: "/settings/users",   icon: Users,     perm: "users.read"   },
      { type: "leaf", name: "Permissions",      href: "/settings/roles",   icon: Shield,    perm: "roles.read"   },
    ],
  },

  // ── Phase 2 (Sales Flow) — hidden ────────────────────────────────────────
  // { type: "leaf", name: "Inquiry",                href: "/inquiry",         icon: MessageSquare },
  // { type: "leaf", name: "Coverage",               href: "/coverage",        icon: Shield        },
  // { type: "leaf", name: "Dispatch Queue",         href: "/dispatch-queue",  icon: ListOrdered   },
  // { type: "leaf", name: "Pick Plan (FIFO + Bin)", href: "/pick-plan",       icon: CheckSquare   },
  // { type: "leaf", name: "Challan & Loading",      href: "/challan",         icon: FileText      },
  // { type: "leaf", name: "In-Transit",             href: "/in-transit",      icon: MapPinned     },
  // {
  //   type: "section", name: "Invoice Tracker", icon: Receipt,
  //   items: [
  //     { type: "leaf", name: "Purchase Invoices", href: "/purchase-invoices", icon: FileInput },
  //     { type: "leaf", name: "Sales Invoices",    href: "/sales-invoices",    icon: Receipt   },
  //   ],
  // },

  // ── Phase 3 (Customer / Reports / Dashboards) — hidden ───────────────────
  // {
  //   type: "section", name: "Dashboards", icon: LayoutDashboard,
  //   items: [
  //     { type: "leaf", name: "Owner Dashboard",    href: "/",                   icon: LayoutDashboard },
  //     { type: "leaf", name: "Accounts Dashboard", href: "/dashboard/accounts", icon: Wallet          },
  //     { type: "leaf", name: "Salesman Dashboard", href: "/dashboard/salesman", icon: UserCheck       },
  //     { type: "leaf", name: "Planner Dashboard",  href: "/dashboard/planner",  icon: Truck           },
  //   ],
  // },
  // {
  //   type: "section", name: "Reports", icon: BarChart3,
  //   items: [
  //     { type: "leaf", name: "Sales & Performance",   href: "/reports/sales-performance",   icon: TrendingUp },
  //     { type: "leaf", name: "Mill & Supply",         href: "/reports/mill-supply",         icon: Factory    },
  //     { type: "leaf", name: "Logistics & Transport", href: "/reports/logistics-transport", icon: Truck      },
  //     { type: "leaf", name: "Finance & Inventory",   href: "/reports/finance-inventory",   icon: Wallet     },
  //   ],
  // },
  // { type: "leaf", name: "Bin Master", href: "/bin-locations", icon: Layers },
];

const NAV_CUSTOMER: TopItem[] = [
  { type: "leaf", name: "My Inquiries", href: "/inquiry", icon: MessageSquare },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sectionHrefs(section: NavSection): string[] {
  return section.items.flatMap((item) =>
    item.type === "leaf" ? [item.href] : item.items.map((l) => l.href)
  );
}

function sectionIsActive(section: NavSection, pathname: string): boolean {
  return sectionHrefs(section).some(
    (href) => href === pathname || (href !== "/" && pathname.startsWith(href))
  );
}

function leafIsActive(href: string, pathname: string): boolean {
  return href === pathname || (href !== "/" && pathname.startsWith(href));
}

// ─── Theme-aware class helper ─────────────────────────────────────────────────

function navCls(dark: boolean) {
  return {
    sidebarBg:  dark ? "bg-[#0f172a]"    : "bg-white",
    brandText:  dark ? "text-white"       : "text-gray-900",
    brandSub:   dark ? "text-slate-400"   : "text-gray-500",
    navNormal:  dark ? "text-slate-200 hover:bg-white/10 hover:text-white"
                     : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
    navActive:  "bg-blue-500 text-white shadow-lg shadow-blue-500/30",
    navSection: dark ? "text-slate-200 hover:bg-white/10 hover:text-white"
                     : "text-gray-700 hover:bg-gray-100 hover:text-gray-900",
    navSecA:    dark ? "text-blue-300 bg-white/8" : "text-blue-600 bg-blue-50",
    divider:    dark ? "border-white/10"  : "border-gray-200",
    subLine:    dark ? "border-white/15"  : "border-gray-200",
    subTxt:     dark ? "text-slate-300 hover:text-white hover:bg-white/8"
                     : "text-gray-500 hover:text-gray-800 hover:bg-gray-100",
    subAct:     dark ? "text-blue-300"    : "text-blue-600",
    iconBtn:    dark ? "text-slate-500 hover:bg-white/10 hover:text-slate-200"
                     : "text-gray-400 hover:bg-gray-100 hover:text-gray-600",
    closeBtn:   dark ? "text-slate-400 hover:bg-white/10"
                     : "text-gray-400 hover:bg-gray-100",
    versionTxt: dark ? "text-slate-500"   : "text-gray-400",
    collIcon:   dark ? "text-slate-300 hover:bg-white/10 hover:text-white"
                     : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
    shadow:     dark ? "shadow-xl"        : "shadow-sm",
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function LeafLink({
  item, pathname, depth = 0, onMobileClose,
}: {
  item: NavLeaf; pathname: string; depth?: number; onMobileClose: () => void;
}) {
  const { isDark } = useTheme();
  const c = navCls(isDark);
  const active = leafIsActive(item.href, pathname);
  return (
    <Link
      href={item.href}
      onClick={onMobileClose}
      className={cn(
        "group flex items-center gap-2.5 rounded-lg py-1.5 text-xs font-medium transition-all duration-150",
        depth === 0 ? "px-3" : depth === 1 ? "pl-4 pr-3" : "pl-6 pr-3",
        active ? c.navActive : c.navNormal
      )}
    >
      <item.icon
        className={cn("h-3.5 w-3.5 flex-shrink-0 transition-transform duration-150", !active && "group-hover:scale-110")}
        strokeWidth={2}
      />
      <span className="truncate">{item.name}</span>
    </Link>
  );
}

function SubGroupBlock({
  group, pathname, onMobileClose,
}: {
  group: NavSubGroup; pathname: string; onMobileClose: () => void;
}) {
  const { isDark } = useTheme();
  const c = navCls(isDark);
  const hasActive = group.items.some((i) => leafIsActive(i.href, pathname));
  const [open, setOpen] = useState(hasActive);

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg px-3 py-1 text-[10px] font-semibold uppercase tracking-wider transition-all duration-150",
          hasActive ? c.subAct : c.subTxt
        )}
      >
        <span className="flex-1 text-left truncate">{group.label}</span>
        <ChevronRight
          className={cn("h-3 w-3 flex-shrink-0 transition-transform duration-200", open && "rotate-90")}
          strokeWidth={2.5}
        />
      </button>
      {open && (
        <div className={cn("mt-0.5 ml-1 space-y-0.5 border-l pl-2", c.subLine)}>
          {group.items.map((item) => (
            <LeafLink key={item.href + item.name} item={item} pathname={pathname} depth={2} onMobileClose={onMobileClose} />
          ))}
        </div>
      )}
    </div>
  );
}

function SectionBlock({
  section, pathname, collapsed, onMobileClose,
}: {
  section: NavSection; pathname: string; collapsed: boolean; onMobileClose: () => void;
}) {
  const { isDark } = useTheme();
  const c = navCls(isDark);
  const { hasPerm } = useAuth();
  const visibleItems = section.items.filter((i) => !i.perm || hasPerm(i.perm));
  const active = visibleItems.some((item) =>
    item.type === "leaf"
      ? leafIsActive(item.href, pathname)
      : item.items.some((l) => leafIsActive(l.href, pathname))
  );
  const [open, setOpen] = useState(active);

  useEffect(() => { if (active) setOpen(true); }, [active]);

  if (collapsed) {
    return (
      <button
        title={section.name}
        className={cn(
          "group flex w-full items-center justify-center rounded-lg py-2 transition-all duration-150",
          active ? c.navSecA : c.collIcon
        )}
      >
        <section.icon className="h-4 w-4 transition-transform duration-150 group-hover:scale-110" strokeWidth={2} />
      </button>
    );
  }

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold transition-all duration-150",
          active ? c.navSecA : c.navSection
        )}
      >
        <section.icon className="h-4 w-4 flex-shrink-0 transition-transform duration-150 group-hover:scale-110" strokeWidth={2} />
        <span className="flex-1 text-left">{section.name}</span>
        <ChevronDown
          className={cn("h-3.5 w-3.5 flex-shrink-0 transition-transform duration-200", open && "rotate-180",
            isDark ? "text-slate-400" : "text-gray-400")}
          strokeWidth={2.5}
        />
      </button>
      {open && visibleItems.length > 0 && (
        <div className="mt-1 space-y-0.5 pl-1">
          {visibleItems.map((item) =>
            item.type === "leaf" ? (
              <LeafLink key={item.href + item.name} item={item} pathname={pathname} depth={1} onMobileClose={onMobileClose} />
            ) : (
              <SubGroupBlock key={item.label} group={item} pathname={pathname} onMobileClose={onMobileClose} />
            )
          )}
        </div>
      )}
    </div>
  );
}

// ─── Customer Sidebar (minimal) ───────────────────────────────────────────────

function CustomerSidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { isDark } = useTheme();
  const c = navCls(isDark);

  return (
    <div className={cn(
      "flex h-full flex-col border-r", c.sidebarBg, c.divider, c.shadow,
      "fixed inset-y-0 left-0 z-50 transition-transform duration-300 w-60",
      mobileOpen ? "translate-x-0" : "-translate-x-full",
      "lg:relative lg:z-auto lg:translate-x-0"
    )}>
      <div className={cn("flex h-16 flex-shrink-0 items-center justify-between border-b px-4", c.divider)}>
        <button onClick={onMobileClose} className={cn("flex h-8 w-8 items-center justify-center rounded-lg lg:hidden", c.closeBtn)}>
          <X className="h-5 w-5" strokeWidth={2} />
        </button>
        <div className="flex-1 min-w-0 px-1">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500 shadow-md shadow-blue-500/30 flex-shrink-0">
              <span className="text-[11px] font-black text-white">M</span>
            </div>
            <div>
              <p className={cn("text-sm font-bold leading-tight", c.brandText)}>Monit Paper</p>
              <p className={cn("text-[10px] truncate", c.brandSub)}>{user?.customerName ?? "Customer Portal"}</p>
            </div>
          </div>
        </div>
      </div>
      <nav className="flex-1 px-2 py-3">
        {NAV_CUSTOMER.map((item) => {
          if (item.type !== "leaf") return null;
          const active = leafIsActive(item.href, pathname);
          return (
            <Link key={item.href} href={item.href} onClick={onMobileClose}
              className={cn("group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
                active ? c.navActive : c.navNormal)}>
              <item.icon className="h-4 w-4 flex-shrink-0" strokeWidth={2} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>
      <div className={cn("border-t px-4 py-3", c.divider)}>
        <p className={cn("text-[10px] text-center", c.versionTxt)}>For support, contact your sales rep</p>
      </div>
    </div>
  );
}

// ─── Main Sidebar ─────────────────────────────────────────────────────────────

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const { isCustomer, hasPerm, user } = useAuth();
  const { isDark } = useTheme();
  const c = navCls(isDark);
  const [collapsed, setCollapsed] = useState(false);
  const companyName = user?.companyName ?? "Monit Paper";

  if (isCustomer) {
    return <CustomerSidebar mobileOpen={mobileOpen} onMobileClose={onMobileClose} />;
  }

  return (
    <div className={cn(
      "flex h-full flex-col border-r", c.sidebarBg, c.divider, c.shadow,
      "fixed inset-y-0 left-0 z-50 transition-transform duration-300",
      mobileOpen ? "translate-x-0" : "-translate-x-full",
      "lg:relative lg:z-auto lg:translate-x-0",
      collapsed ? "w-14 lg:w-14" : "w-72 lg:w-60",
      "lg:transition-[width] lg:duration-300"
    )}>
      {/* Brand header */}
      <div className={cn("flex h-16 flex-shrink-0 items-center justify-between border-b px-3", c.divider)}>
        <button onClick={onMobileClose} className={cn("flex h-8 w-8 items-center justify-center rounded-lg lg:hidden", c.closeBtn)}>
          <X className="h-5 w-5" strokeWidth={2} />
        </button>
        {!collapsed && (
          <div className="flex flex-1 min-w-0 items-center gap-2.5 px-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500 shadow-md shadow-blue-500/40 flex-shrink-0">
              <span className="text-sm font-black text-white">M</span>
            </div>
            <div className="min-w-0">
              <p className={cn("text-sm font-bold leading-tight truncate", c.brandText)}>{companyName}</p>
              <p className={cn("text-[10px] leading-tight", c.brandSub)}>ERP System</p>
            </div>
          </div>
        )}
        <button
          onClick={() => setCollapsed((v) => !v)}
          title={collapsed ? "Expand" : "Collapse"}
          className={cn("hidden lg:flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition-colors", c.iconBtn,
            collapsed && "mx-auto")}
        >
          {collapsed
            ? <PanelLeftOpen className="h-4 w-4" strokeWidth={2} />
            : <PanelLeftClose className="h-4 w-4" strokeWidth={2} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
        {NAV_ADMIN.filter((item) => !item.perm || hasPerm(item.perm)).map((item) => {
          if (item.type === "leaf") {
            const active = leafIsActive(item.href, pathname);
            if (collapsed) {
              return (
                <Link key={item.href + item.name} href={item.href} title={item.name} onClick={onMobileClose}
                  className={cn("group flex items-center justify-center rounded-lg py-2 transition-all duration-150",
                    active ? c.navActive : c.collIcon)}>
                  <item.icon className="h-4 w-4 transition-transform duration-150 group-hover:scale-110" strokeWidth={2} />
                </Link>
              );
            }
            return (
              <Link key={item.href + item.name} href={item.href} onClick={onMobileClose}
                className={cn("group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
                  active ? c.navActive : c.navNormal)}>
                <item.icon className="h-4 w-4 flex-shrink-0 transition-transform duration-150 group-hover:scale-110" strokeWidth={2} />
                <span className="truncate">{item.name}</span>
              </Link>
            );
          }
          return (
            <SectionBlock key={item.name} section={item} pathname={pathname} collapsed={collapsed} onMobileClose={onMobileClose} />
          );
        })}
      </nav>

      {/* Bottom version tag */}
      {!collapsed && (
        <div className={cn("border-t px-4 py-2.5", c.divider)}>
          <p className={cn("text-[10px]", c.versionTxt)}>Monit ERP · v1.0</p>
        </div>
      )}
    </div>
  );
}
