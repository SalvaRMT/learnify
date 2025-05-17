
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CalendarDays, BarChart3, User, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Practice", icon: BookOpen },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/statistics", label: "Stats", icon: BarChart3 },
  { href: "/profile", label: "Profile", icon: User },
];

export function BottomNavbar() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/80 backdrop-blur-md shadow-top-md">
      <div className="mx-auto flex h-16 max-w-md items-center justify-around px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href === "/dashboard" && pathname.startsWith("/dashboard"));
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center space-y-1 rounded-md p-2 text-sm font-medium transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-primary/80",
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <item.icon className={cn("h-6 w-6", isActive ? "fill-primary/20" : "")} />
              <span className={cn("text-xs", isActive ? "font-semibold" : "")}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

// Custom shadow utility for top shadow, add to globals.css or tailwind.config if preferred
// For now, will use a simple border-t and bg-background
// Add to tailwind.config.ts theme.extend:
// boxShadow: {
//   'top-md': '0 -4px 6px -1px rgb(0 0 0 / 0.1), 0 -2px 4px -2px rgb(0 0 0 / 0.1)',
// }
// Then use shadow-top-md class on the nav element.
// For simplicity I'll use border-t for now.
