"use client";

import * as React from "react"
import { format, parse, isValid, startOfDay } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/ui/button"
import { Calendar } from "@/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/ui/popover"

interface DatePickerProps {
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  min?: string;
  max?: string;
}

export function DatePicker({ value, onChange, className, placeholder = "Select date", disabled, min, max }: DatePickerProps) {
  const date = value ? parse(value, "yyyy-MM-dd", new Date()) : undefined;
  // Ensure the date is valid before passing to Calendar
  const selectedDate = date && isValid(date) ? date : undefined;

  const minDate = min ? startOfDay(parse(min, "yyyy-MM-dd", new Date())) : undefined;
  const maxDate = max ? startOfDay(parse(max, "yyyy-MM-dd", new Date())) : undefined;

  const handleSelect = (newDate: Date | undefined) => {
    if (newDate && onChange) {
      // Format back to yyyy-MM-dd for backward compatibility with native <input type="date">
      onChange(format(newDate, "yyyy-MM-dd"));
    } else if (!newDate && onChange) {
      onChange("");
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-full justify-start text-left font-normal",
            !selectedDate && "text-muted-foreground",
            className
          )}
          disabled={disabled}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {selectedDate ? format(selectedDate, "dd/MM/yyyy") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          disabled={(dateToCheck) => {
            let isDisabled = false;
            const check = startOfDay(dateToCheck);
            if (minDate && isValid(minDate)) {
              isDisabled = isDisabled || check < minDate;
            }
            if (maxDate && isValid(maxDate)) {
              isDisabled = isDisabled || check > maxDate;
            }
            return isDisabled;
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}
