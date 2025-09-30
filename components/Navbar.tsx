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
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const isDashboard =
    pathname?.startsWith("/dashboard") || pathname?.includes("/sprints");

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

  const handleNavClick = (href: string) => {
    startTransition(() => {
      router.push(href);
    });
    setIsOpen(false);
  };

  return (
    
    <nav className="w-full z-50 border-b border-border bg-background/70 backdrop-blur-md relative">
      {/* Loading bar */}
      <AnimatePresence>
        {isPending && (
          <motion.div
            key="loading-bar"
            className="absolute top-0 left-0 h-0.5 bg-primary"
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
          />
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-24 py-4 flex items-center justify-between">
        {/* Brand */}
        <Link
          href="/"
          onClick={(e) => {
            e.preventDefault();
            handleNavClick("/");
          }}
          className="text-xl font-bold tracking-tight"
        >
          Remote<span className="text-primary">Hub</span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center space-x-8 text-sm font-medium">
          {activeNav.map((link) => (
            <button
              key={link.href}
              onClick={() => handleNavClick(link.href)}
              className="relative group text-muted-foreground hover:text-foreground transition"
            >
              {link.label}
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary group-hover:w-full transition-all duration-300" />
            </button>
          ))}
        </div>

        {/* Controls */}
        <div className="hidden md:flex items-center space-x-4">
          {isDashboard && (
            <OrganizationSwitcher
              appearance={{
                elements: {
                  organizationSwitcherTrigger:
                    "border border-border px-2 py-1 rounded-md",
                },
              }}
            />
          )}

          <SignedOut>
            <SignInButton mode="modal">
              <Button
                variant="outline"
                size="sm"
                disabled={isPending}
                className="relative"
              >
                {isPending ? (
                  <motion.div
                    className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"
                    aria-label="loading"
                  />
                ) : (
                  "Sign In"
                )}
              </Button>
            </SignInButton>
            <SignUpButton mode="modal">
              <Button size="sm" disabled={isPending}>
                {isPending ? "Loading..." : "Get Started"}
              </Button>
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
                <button
                  key={link.href}
                  onClick={() => handleNavClick(link.href)}
                  className="text-muted-foreground hover:text-foreground transition text-left"
                >
                  {link.label}
                </button>
              ))}

              {isDashboard && (
                <OrganizationSwitcher
                  appearance={{
                    elements: {
                      organizationSwitcherTrigger:
                        "border border-border px-2 py-1 rounded-md mt-2",
                    },
                  }}
                />
              )}

              <SignedOut>
                <SignInButton mode="modal">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={isPending}
                  >
                    {isPending ? "Loading..." : "Sign In"}
                  </Button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <Button size="sm" className="w-full" disabled={isPending}>
                    {isPending ? "Loading..." : "Get Started"}
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
