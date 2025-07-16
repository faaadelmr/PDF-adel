"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import ThemeSwitcher from "@/components/theme-switcher";
import { LogIn, Combine, SeparatorVertical } from "lucide-react";

const navItems = [
  { href: "/select", label: "Select", icon: SeparatorVertical, color: "text-accent" },
  { href: "/merge", label: "Merge", icon: Combine, color: "text-primary" },
];

export default function Header() {
  return (
    <header className="bg-card/80 backdrop-blur-sm sticky top-0 z-50 border-b border-primary/10">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="text-2xl font-bold text-primary font-headline tracking-widest">
              PDF-adel
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <nav className="flex items-center space-x-1">
              {navItems.map((item) => (
                <Button key={item.label} variant="ghost" asChild size="sm">
                  <Link href={item.href} className={`text-xs font-medium ${item.color} hover:${item.color}/80`}>
                    <item.icon className="mr-1 h-4 w-4" />
                    {item.label}
                  </Link>
                </Button>
              ))}
            </nav>
            
            <ThemeSwitcher />
            
            <Button variant="ghost" size="icon">
              <LogIn />
              <span className="sr-only">Login</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
