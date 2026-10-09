"use client";

import { useState } from "react";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/ui/popover";
import { Clock } from "lucide-react";

interface TimePickerProps {
  value: string;
  onChange: (time: string) => void;
  required?: boolean;
}

export const TimePicker = ({ value, onChange, required }: TimePickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  
  // Parse current time or set defaults
  const [hours, minutes] = value ? value.split(':').map(Number) : [9, 0];
  
  const formatTime = (h: number, m: number) => {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  const formatDisplayTime = (h: number, m: number) => {
    const period = h >= 12 ? 'PM' : 'AM';
    const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${displayHour}:${m.toString().padStart(2, '0')} ${period}`;
  };

  const handleTimeChange = (newHours: number, newMinutes: number) => {
    const timeString = formatTime(newHours, newMinutes);
    onChange(timeString);
  };

  const timeSlots = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      timeSlots.push({ hours: h, minutes: m });
    }
  }

  return (
    <div className="space-y-2">
      <Label>Time *</Label>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-start text-left font-normal"
            type="button"
          >
            <Clock className="mr-2 h-4 w-4" />
            {value ? formatDisplayTime(hours, minutes) : "Select time"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-4">
            <div className="space-y-4">
              <div className="text-sm font-medium text-center">Select Time</div>
              
              {/* Quick Time Buttons */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "9:00 AM", time: "09:00" },
                  { label: "12:00 PM", time: "12:00" },
                  { label: "3:00 PM", time: "15:00" },
                  { label: "6:00 PM", time: "18:00" },
                ].map((slot) => (
                  <Button
                    key={slot.time}
                    variant={value === slot.time ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      onChange(slot.time);
                      setIsOpen(false);
                    }}
                    type="button"
                  >
                    {slot.label}
                  </Button>
                ))}
              </div>

              {/* Manual Time Input */}
              <div className="border-t pt-4">
                <div className="space-y-2">
                  <Label className="text-xs">Enter custom time:</Label>
                  <Input
                    type="time"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full"
                  />
                </div>
              </div>

              {/* Business Hours Grid */}
              <div className="border-t pt-4">
                <div className="text-xs text-gray-500 mb-2">Business Hours (9 AM - 6 PM):</div>
                <div className="grid grid-cols-4 gap-1 mb-3">
                  {timeSlots
                    .filter(slot => 
                      slot.hours >= 9 && 
                      slot.hours <= 18 && 
                      (slot.minutes === 0 || slot.minutes === 30)
                    )
                    .map((slot) => {
                      const timeString = formatTime(slot.hours, slot.minutes);
                      const isSelected = value === timeString;
                      
                      return (
                        <Button
                          key={timeString}
                          variant={isSelected ? "default" : "ghost"}
                          size="sm"
                          className="text-xs h-8"
                          onClick={() => {
                            onChange(timeString);
                            setIsOpen(false);
                          }}
                          type="button"
                        >
                          {formatDisplayTime(slot.hours, slot.minutes)}
                        </Button>
                      );
                    })}
                </div>
              </div>

              {/* All Day Times */}
              <div className="border-t pt-4">
                <div className="text-xs text-gray-500 mb-2">All times (every 30 min):</div>
                <div className="grid grid-cols-4 gap-1 max-h-32 overflow-y-auto">
                  {timeSlots.filter(slot => slot.minutes === 0 || slot.minutes === 30).map((slot) => {
                    const timeString = formatTime(slot.hours, slot.minutes);
                    const isSelected = value === timeString;
                    
                    return (
                      <Button
                        key={timeString}
                        variant={isSelected ? "default" : "ghost"}
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => {
                          onChange(timeString);
                          setIsOpen(false);
                        }}
                        type="button"
                      >
                        {formatDisplayTime(slot.hours, slot.minutes)}
                      </Button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
