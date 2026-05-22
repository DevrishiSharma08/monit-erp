"use client";

import Link from "next/link";
import { Bell, Menu, ChevronRight, LogOut, Sun, Moon, Settings2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useNotifications } from "@/context/NotificationContext";
import { NotificationPanel } from "@/components/NotificationPanel";

const pageNames: Record<string, string> = {
  "/": "Dashboard",
  "/inquiry": "Customer Inquiry",
  "/customers": "Customers",
  "/orders": "Sales Orders",
  "/coverage": "Coverage",
  "/dispatch-queue": "Dispatch Queue",
  "/pick-plan": "Pick Plan",
  "/truck-load-plan": "Truck Load Planner",
  "/challan": "Challan & Loading",
  "/in-transit": "In Transit Tracking",
  "/grn": "GRN - Goods Receipt Notes",
  "/purchase-orders": "Purchase Orders",
  "/mill-tracker": "Mill Order Tracker",
  "/purchase-invoices": "Purchase Invoice",
  "/sales-invoices": "Sales Invoice",
  "/tally-export": "Tally Export",
  "/payments": "Payments",
  "/bin-locations": "Bin Locations",
  "/stock-lots": "Stock Location",
  "/reports": "Reports",
  "/reports/sales-performance": "Sales & Performance",
  "/reports/mill-supply": "Mill & Supply",
  "/reports/logistics-transport": "Logistics & Transport",
  "/reports/finance-inventory": "Finance & Inventory",
  "/reports/sales-performance/sales-summary": "Sales Summary",
  "/reports/sales-performance/customer-wise-volume": "Customer Wise Volume",
  "/reports/sales-performance/product-wise-sales": "Product Wise Sales",
  "/reports/sales-performance/quality-wise-sales-trend": "Quality Wise Sales Trend",
  "/reports/sales-performance/salesman-performance": "Salesman Performance",
  "/reports/sales-performance/target-vs-order-lifted": "Target vs Order Lifted",
  "/reports/sales-performance/inquiry-conversion-funnel": "Inquiry Conversion Funnel",
  "/reports/mill-supply/product-against-supply": "Product Against Supply",
  "/reports/mill-supply/mill-performance": "Mill Performance",
  "/reports/mill-supply/customer-order-by-mill": "Customer Order by Mill",
  "/reports/mill-supply/product-ready-vs-transport-delay": "Product Ready vs Transport Delay",
  "/reports/logistics-transport/transporter-performance": "Transporter Performance",
  "/reports/logistics-transport/in-transit-delay-report": "In Transit Delay Report",
  "/reports/finance-inventory/customer-aging": "Customer Aging",
  "/reports/finance-inventory/inventory-report": "Inventory Report",
  "/dashboard/owner": "Owner Dashboard",
  "/dashboard/planner": "Planner Dashboard",
  "/dashboard/salesman": "Salesman Dashboard",
  "/dashboard/accounts": "Accounts Dashboard",
  "/settings/users":   "User Management",
  "/settings/roles":   "Role Management",
  "/settings/teams":   "Team Management",
  "/settings/company": "Company Configuration",
  "/masters": "Masters",
  "/masters/materials": "Item Master",
  "/masters/mills": "Mill Master",
  "/masters/units": "Unit Master",
  "/masters/salesmen": "Salesman Master",
  "/masters/locations": "Location Master",
  "/masters/sizes": "Size Master",
  "/masters/categories": "Quality Master",
  "/masters/stock-category": "GSM Master",
  "/masters/mqg": "MQG Master",
  "/masters/item-type": "Item Type",
  "/masters/customers": "Customer Master",
  "/masters/warehouse": "Warehouse Master",
  "/masters/transporters": "Transporter Master",
  "/masters/rates": "Rate Master",
  "/approvals": "Approvals",
};

function getBreadcrumbs(pathname: string): { label: string; href: string; isLast: boolean }[] {
  if (pathname === "/") return [{ label: "Dashboard", href: "/", isLast: true }];

  if (pageNames[pathname] && !pathname.includes("/", 1)) {
    return [{ label: pageNames[pathname], href: pathname, isLast: true }];
  }

  const segments = pathname.split("/").filter(Boolean);
  const crumbs: { label: string; href: string; isLast: boolean }[] = [];

  let builtPath = "";
  for (let i = 0; i < segments.length; i++) {
    builtPath += "/" + segments[i];
    const name = pageNames[builtPath];
    if (name) {
      crumbs.push({ label: name, href: builtPath, isLast: i === segments.length - 1 });
    }
  }

  if (crumbs.length === 0) {
    const direct = pageNames[pathname];
    return [{ label: direct || "Dashboard", href: pathname, isLast: true }];
  }

  return crumbs;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

interface HeaderProps {
  onMobileMenuToggle: () => void;
}

export function Header({ onMobileMenuToggle }: HeaderProps) {
  const pathname = usePathname();
  const breadcrumbs = getBreadcrumbs(pathname);
  const { user, logout } = useAuth();
  const { isDark, toggle } = useTheme();
  const { unreadCount } = useNotifications();
  const router = useRouter();
  const [notifOpen,   setNotifOpen]   = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const bellRef    = useRef<HTMLButtonElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close profile dropdown on outside click
  useEffect(() => {
    if (!profileOpen) return;
    function handle(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node))
        setProfileOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [profileOpen]);

  const h = {
    bg:         isDark ? "bg-[#111827]"  : "bg-white",
    border:     isDark ? "border-white/5": "border-gray-200",
    iconBtn:    isDark ? "text-slate-400 hover:bg-white/10 hover:text-white"
                       : "text-gray-500 hover:bg-gray-100 hover:text-gray-700",
    breadSep:   isDark ? "text-slate-600" : "text-gray-300",
    pageTitle:  isDark ? "text-white"     : "text-gray-900",
    breadLink:  isDark ? "text-slate-400 hover:text-blue-400" : "text-gray-400 hover:text-blue-600",
    bellActive: isDark ? "bg-white/10 text-white"  : "bg-gray-100 text-gray-700",
    bellIdle:   isDark ? "text-slate-400 hover:bg-white/10 hover:text-white"
                       : "text-gray-500 hover:bg-gray-100 hover:text-gray-700",
    ringColor:  isDark ? "ring-[#111827]" : "ring-white",
    divider:    isDark ? "border-white/10": "border-gray-200",
    profileHov: isDark ? "hover:bg-white/10" : "hover:bg-gray-100",
    nameText:   isDark ? "text-white"     : "text-gray-900",
    subText:    isDark ? "text-slate-400" : "text-gray-500",
    subHov:     isDark ? "group-hover:text-slate-300" : "group-hover:text-gray-700",
    dropBg:     isDark ? "bg-[#1f2937] border-white/10" : "bg-white border-gray-200",
    dropTxt:    isDark ? "text-slate-300 hover:bg-white/10 hover:text-white"
                       : "text-gray-700 hover:bg-gray-100 hover:text-gray-900",
    dropIcon:   isDark ? "text-slate-400" : "text-gray-400",
  };

  return (
    <header className={`flex h-16 items-center justify-between border-b ${h.border} ${h.bg} px-4 lg:px-6 flex-shrink-0 shadow-[0_2px_12px_rgba(0,0,0,0.08)]`}>
      <div className="flex items-center gap-3">
        {/* Hamburger — mobile only */}
        <button
          onClick={onMobileMenuToggle}
          className={`flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-150 lg:hidden ${h.iconBtn}`}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" strokeWidth={2} />
        </button>

        <div className="flex items-center gap-1.5">
          {breadcrumbs.map((crumb, idx) => (
            <span key={idx} className="flex items-center gap-1.5">
              {idx > 0 && <ChevronRight className={`h-4 w-4 flex-shrink-0 ${h.breadSep}`} />}
              {crumb.isLast ? (
                <h2 className={`text-xl lg:text-2xl font-bold truncate ${h.pageTitle}`}>
                  {crumb.label}
                </h2>
              ) : (
                <Link
                  href={crumb.href}
                  className={`text-lg lg:text-xl font-medium truncate transition-colors duration-150 ${h.breadLink}`}
                >
                  {crumb.label}
                </Link>
              )}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <button
          onClick={toggle}
          title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          className={`relative flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-150 ${h.iconBtn}`}
        >
          <span className={`absolute transition-all duration-300 ${isDark ? "opacity-0 rotate-90 scale-50" : "opacity-100 rotate-0 scale-100"}`}>
            <Sun className="h-4 w-4" />
          </span>
          <span className={`absolute transition-all duration-300 ${isDark ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-50"}`}>
            <Moon className="h-4 w-4" />
          </span>
        </button>

        {/* Notification bell */}
        <button
          ref={bellRef}
          onClick={() => setNotifOpen((o) => !o)}
          className={`relative rounded-lg p-2 transition-all duration-150 group ${notifOpen ? h.bellActive : h.bellIdle}`}
        >
          <Bell className="h-5 w-5 transition-transform duration-150 group-hover:scale-110" />
          {unreadCount > 0 && (
            <span className={`absolute -top-1 -right-1 flex min-w-[16px] h-4 items-center justify-center px-1 rounded-full bg-red-500 text-[9px] font-bold text-white leading-none ring-2 ${h.ringColor}`}>
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        <NotificationPanel
          anchorRef={bellRef}
          open={notifOpen}
          onClose={() => setNotifOpen(false)}
        />

        {/* Profile dropdown */}
        {user && (
          <div ref={profileRef} className={`relative pl-2 border-l ${h.divider}`}>
            <button
              onClick={() => setProfileOpen((o) => !o)}
              className={`flex items-center gap-2.5 rounded-lg px-2 py-1 transition-all duration-150 group ${h.profileHov}`}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white flex-shrink-0 ring-2 ring-blue-400/30">
                {getInitials(user.name)}
              </div>
              <div className="text-left hidden sm:block">
                <p className={`text-sm font-semibold leading-tight ${h.nameText}`}>{user.name}</p>
                <p className={`text-[11px] leading-tight ${h.subText} ${h.subHov}`}>
                  {user.customerName ?? user.role}
                </p>
              </div>
            </button>

            {/* Dropdown panel */}
            {profileOpen && (
              <div className={`absolute right-0 top-full mt-2 w-52 rounded-xl border shadow-2xl shadow-black/20 overflow-hidden z-50 ${h.dropBg}`}>
                {/* User info header */}
                <div className={`px-4 py-3 border-b ${h.divider}`}>
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white ring-2 ring-blue-400/30">
                      {getInitials(user.name)}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold truncate ${h.nameText}`}>{user.name}</p>
                      <p className={`text-[11px] truncate ${h.subText}`}>{user.customerName ?? user.role}</p>
                    </div>
                  </div>
                </div>

                {/* Menu items */}
                <div className="py-1">
                  <button
                    onClick={() => { setProfileOpen(false); router.push("/settings/company"); }}
                    className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-sm transition-colors ${h.dropTxt}`}
                  >
                    <Settings2 className={`h-4 w-4 flex-shrink-0 ${h.dropIcon}`} />
                    Company Settings
                  </button>
                </div>

                <div className={`border-t ${h.divider} py-1`}>
                  <button
                    onClick={() => { setProfileOpen(false); logout(); }}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-gray-500 hover:bg-rose-50 hover:text-rose-500 dark:text-slate-300 dark:hover:bg-rose-500/20 dark:hover:text-rose-400 transition-colors"
                  >
                    <LogOut className="h-4 w-4 flex-shrink-0" />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
