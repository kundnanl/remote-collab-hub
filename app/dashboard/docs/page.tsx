"use client";

import { trpc } from "@/server/client";
import { Plus, Info, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@radix-ui/react-tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const filters = ["ALL", "OWNED", "SHARED"] as const;
type FilterOption = (typeof filters)[number];

export default function DocsPage() {
  const { data: documents, isLoading } = trpc.docs.getMyDocuments.useQuery();
  const [filter, setFilter] = useState<FilterOption>("ALL");
  const [navLoading, setNavLoading] = useState(false);
  const router = useRouter();

  const filteredDocs = useMemo(() => {
    if (!documents) return [];
    if (filter === "ALL") return documents;
    if (filter === "OWNED")
      return documents.filter((d: { role: string }) => d.role === "OWNER");
    return documents.filter((d: { role: string }) => d.role !== "OWNER");
  }, [documents, filter]);

  const handleNavigate = (href: string) => {
    setNavLoading(true);
    router.push(href);
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Documents</h1>
          <p className="text-sm text-muted-foreground">
            Browse, filter and manage your docs.
          </p>
        </div>

        <Button
          size="sm"
          className="flex gap-2"
          onClick={() => handleNavigate("/dashboard/docs/new")}
          disabled={navLoading}
        >
          {navLoading ? (
            <Loader2 className="animate-spin" size={16} />
          ) : (
            <>
              <Plus size={16} /> New Document
            </>
          )}
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex justify-end">
        <Select
          value={filter}
          onValueChange={(val) => setFilter(val as FilterOption)}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by role" />
          </SelectTrigger>
          <SelectContent>
            {filters.map((f) => (
              <SelectItem key={f} value={f}>
                {f.charAt(0).toUpperCase() + f.slice(1).toLowerCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Skeleton loading */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl border" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && filteredDocs.length === 0 && (
        <div className="flex flex-col items-center justify-center text-center py-24">
          <motion.img
            src="/empty-docs.svg"
            alt="No docs"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="w-40 h-40 mb-6"
          />
          <h2 className="text-lg font-medium text-gray-800 mb-1">
            No documents found
          </h2>
          <p className="text-sm text-muted-foreground">
            Try changing your filter or create a new document to get started.
          </p>
        </div>
      )}

      {/* Docs grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence>
          {filteredDocs.map(
            (
              doc: {
                id: string;
                title: string;
                role: string;
                createdAt: string;
              },
              i
            ) => (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ delay: i * 0.04 }}
                className="bg-white rounded-xl p-5 border border-gray-200 hover:shadow-md transition group cursor-pointer"
                onClick={() => handleNavigate(`/dashboard/docs/${doc.id}`)}
              >
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-gray-900 group-hover:text-indigo-600 transition truncate">
                    {doc.title}
                  </h3>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-1 cursor-default">
                            <Info size={14} />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{doc.role}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <span>
                      Created {new Date(doc.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </motion.div>
            )
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
