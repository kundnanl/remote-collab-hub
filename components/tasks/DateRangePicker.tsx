"use client";

import * as React from "react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";

export function DateRangePicker({
    value,
    onChange,
    placeholder = "Pick a date range",
}: {
    value: DateRange | undefined;
    onChange: (range: DateRange | undefined) => void;
    placeholder?: string;
}) {
    const label =
        value?.from && value?.to
            ? `${format(value.from, "PPP")} – ${format(value.to, "PPP")}`
            : placeholder;

    return (
        <Popover modal={true}>
            <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {label}
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="w-auto p-0 z-[9999]"
                align="start"
                side="bottom"
                sideOffset={8}
            >
                <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={value?.from}
                    selected={value}
                    onSelect={onChange}
                    numberOfMonths={2}
                />
            </PopoverContent>
        </Popover>
    );
}
