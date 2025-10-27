"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function DownloadPdfButton({ runId }: { runId: string }) {
    const [loading, setLoading] = useState(false);

    const handleDownload = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/reports/pdf/${runId}`);
            if (!res.ok) throw new Error("Failed to generate PDF");

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${runId}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error("PDF download failed:", err);
            alert("Failed to download report PDF");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Button
            variant="outline"
            onClick={handleDownload}
            disabled={loading}
            size="default" // or "sm" / "lg"
            className={cn(
                "relative flex items-center justify-center gap-2 transition-all min-w-[160px]",
                loading && "cursor-wait opacity-80"
            )}
        >
            {loading ? (
                <>
                    <Loader2 className="!h-4 !w-4 animate-spin text-muted-foreground" />
                    <span className="text-sm font-medium whitespace-nowrap">Generating…</span>
                </>
            ) : (
                <span className="text-sm font-medium whitespace-nowrap">Download PDF</span>
            )}
        </Button>
    );
}
