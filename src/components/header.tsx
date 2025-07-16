"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import ThemeSwitcher from "@/components/theme-switcher";
import { LogIn, Menu, FileJson, Scissors, SplitSquareHorizontal } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet";

const navItems = [
  { href: "#", label: "Pdf Merge", icon: FileJson },
  { href: "/", label: "Pdf Selected", icon: Scissors },
  { href: "/split", label: "Split PDF", icon: SplitSquareHorizontal },
];

export default function Header() {
  return (
    <header className="bg-card/80 backdrop-blur-sm sticky top-0 z-50 border-b">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="text-2xl font-bold text-primary font-headline">
              Tanma
            </Link>
          </div>

          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => (
              <Button key={item.label} variant="ghost" asChild>
                <Link href={item.href} className="text-sm font-medium">
                  <item.icon className="mr-2 h-4 w-4" />
                  {item.label}
                </Link>
              </Button>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            <ThemeSwitcher />
            <Button variant="ghost" size="icon" className="hidden md:inline-flex">
              <LogIn />
              <span className="sr-only">Login</span>
            </Button>
            
            <div className="md:hidden">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Menu />
                    <span className="sr-only">Open menu</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="right">
                  <div className="flex flex-col h-full">
                    <div className="flex-grow">
                      <nav className="flex flex-col space-y-2 mt-6">
                        {navItems.map((item) => (
                          <SheetClose asChild key={item.label}>
                            <Button variant="ghost" className="justify-start" asChild>
                               <Link href={item.href} >
                                 <item.icon className="mr-2 h-4 w-4" />
                                 {item.label}
                               </Link>
                            </Button>
                          </SheetClose>
                        ))}
                      </nav>
                    </div>
                    <Button variant="outline" asChild>
                      <Link href="#">
                        <LogIn className="mr-2 h-4 w-4" />
                        Login
                      </Link>
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
