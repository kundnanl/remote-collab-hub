"use client";

import Link from "next/link";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
  OrganizationSwitcher,
} from "@clerk/nextjs";
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const isDashboard = pathname?.startsWith("/dashboard") || pathname?.includes("/sprints");

  const landingNav = [
    { label: "Home", href: "/" },
    { label: "Features", href: "#features" },
    { label: "How It Works", href: "#how-it-works" },
    { label: "Get Started", href: "/sign-up" },
  ];

  const appNav = [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Tasks", href: "/dashboard/tasks" },
    { label: "Docs", href: "/dashboard/docs" },
    { label: "Office", href: "/dashboard/office" },
  ];

  const activeNav = isDashboard ? appNav : landingNav;

  return (
    <nav className="w-full z-50 border-b border-gray-200 bg-white/70 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-24 py-4 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="text-xl font-bold tracking-tight">
          Remote<span className="text-indigo-600">Hub</span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center space-x-8 text-sm font-medium">
          {activeNav.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="relative group text-gray-700 hover:text-gray-900 transition"
            >
              {link.label}
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-indigo-600 group-hover:w-full transition-all duration-300" />
            </Link>
          ))}
        </div>

        {/* Controls */}
        <div className="hidden md:flex items-center space-x-4">
          {isDashboard && (
            <OrganizationSwitcher
              appearance={{
                elements: {
                  organizationSwitcherTrigger:
                    "border border-gray-200 px-2 py-1 rounded-md",
                },
              }}
            />
          )}
          <SignedOut>
            <SignInButton mode="modal">
              <Button variant="outline" size="sm">
                Sign In
              </Button>
            </SignInButton>
            <SignUpButton mode="modal">
              <Button size="sm">Get Started</Button>
            </SignUpButton>
          </SignedOut>
          <SignedIn>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
        </div>

        {/* Mobile Hamburger */}
        <button onClick={() => setIsOpen(!isOpen)} className="md:hidden">
          {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Nav */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden px-6 pb-4"
          >
            <div className="flex flex-col space-y-3 text-sm font-medium">
              {activeNav.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className="text-gray-700 hover:text-gray-900 transition"
                >
                  {link.label}
                </Link>
              ))}

              {isDashboard && (
                <OrganizationSwitcher
                  appearance={{
                    elements: {
                      organizationSwitcherTrigger:
                        "border border-gray-200 px-2 py-1 rounded-md mt-2",
                    },
                  }}
                />
              )}

              <SignedOut>
                <SignInButton mode="modal">
                  <Button variant="outline" size="sm" className="w-full">
                    Sign In
                  </Button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <Button size="sm" className="w-full">
                    Get Started
                  </Button>
                </SignUpButton>
              </SignedOut>
              <SignedIn>
                <UserButton afterSignOutUrl="/" />
              </SignedIn>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
