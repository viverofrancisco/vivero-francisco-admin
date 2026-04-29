"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const DIAS_SEMANA = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"];

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minDate?: string;
  maxDate?: string;
  className?: string;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1; // Monday = 0
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Seleccionar fecha",
  minDate,
  maxDate,
  className,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [openAbove, setOpenAbove] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Calendar navigation state
  const today = new Date();
  const initialDate = value ? new Date(value + "T00:00:00") : today;
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());
  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [showMonthSelect, setShowMonthSelect] = useState(false);
  const [showYearSelect, setShowYearSelect] = useState(false);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setShowMonthSelect(false);
        setShowYearSelect(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // When value changes externally, sync the view
  useEffect(() => {
    if (value) {
      const d = new Date(value + "T00:00:00");
      setViewMonth(d.getMonth());
      setViewYear(d.getFullYear());
    }
  }, [value]);

  const years = useMemo(() => {
    const current = today.getFullYear();
    const arr: number[] = [];
    for (let y = current - 5; y <= current + 5; y++) arr.push(y);
    return arr;
  }, []);

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);

  const isDateDisabled = (dateStr: string) => {
    if (minDate && dateStr < minDate) return true;
    if (maxDate && dateStr > maxDate) return true;
    return false;
  };

  const handleSelectDay = (day: number) => {
    const m = String(viewMonth + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    const dateStr = `${viewYear}-${m}-${d}`;
    if (!isDateDisabled(dateStr)) {
      onChange(dateStr);
      setOpen(false);
    }
  };

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const formatDisplay = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("es-EC", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  };

  return (
    <div ref={ref} className={cn("relative", className)}>
      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (!open && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            setOpenAbove(spaceBelow < 360);
          }
          setOpen(!open);
        }}
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-md border bg-background px-3 py-1 text-sm ring-offset-background transition-colors",
          "hover:bg-accent hover:text-accent-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          !value && "text-muted-foreground"
        )}
      >
        <span className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          {value ? formatDisplay(value) : placeholder}
        </span>
        {value && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
              setOpen(false);
            }}
            className="rounded p-0.5 hover:bg-gray-200"
          >
            <X className="h-3 w-3 text-muted-foreground" />
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className={cn(
          "absolute z-50 w-72 rounded-md border bg-white p-3 shadow-lg",
          openAbove ? "bottom-full mb-1" : "top-full mt-1"
        )}>
          {/* Header: month/year navigation */}
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="rounded p-1 hover:bg-gray-100"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-1">
              {/* Month selector */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowMonthSelect(!showMonthSelect);
                    setShowYearSelect(false);
                  }}
                  className="rounded px-2 py-1 text-sm font-medium hover:bg-gray-100"
                >
                  {MESES[viewMonth]}
                </button>
                {showMonthSelect && (
                  <div className="absolute top-full left-0 z-10 mt-1 max-h-48 w-36 overflow-y-auto rounded-md border bg-white shadow-lg">
                    {MESES.map((m, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setViewMonth(i);
                          setShowMonthSelect(false);
                        }}
                        className={cn(
                          "flex w-full px-3 py-1.5 text-sm hover:bg-gray-50 text-left",
                          viewMonth === i && "bg-primary/10 text-primary font-medium"
                        )}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Year selector */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowYearSelect(!showYearSelect);
                    setShowMonthSelect(false);
                  }}
                  className="rounded px-2 py-1 text-sm font-medium hover:bg-gray-100"
                >
                  {viewYear}
                </button>
                {showYearSelect && (
                  <div className="absolute top-full right-0 z-10 mt-1 max-h-48 w-24 overflow-y-auto rounded-md border bg-white shadow-lg">
                    {years.map((y) => (
                      <button
                        key={y}
                        type="button"
                        onClick={() => {
                          setViewYear(y);
                          setShowYearSelect(false);
                        }}
                        className={cn(
                          "flex w-full px-3 py-1.5 text-sm hover:bg-gray-50 text-left",
                          viewYear === y && "bg-primary/10 text-primary font-medium"
                        )}
                      >
                        {y}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              className="rounded p-1 hover:bg-gray-100"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 gap-0 mb-1">
            {DIAS_SEMANA.map((d) => (
              <div
                key={d}
                className="text-center text-xs font-medium text-muted-foreground py-1"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-0">
            {/* Empty cells for days before the 1st */}
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="h-8" />
            ))}
            {/* Day cells */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const m = String(viewMonth + 1).padStart(2, "0");
              const d = String(day).padStart(2, "0");
              const dateStr = `${viewYear}-${m}-${d}`;
              const isSelected = value === dateStr;
              const isToday =
                day === today.getDate() &&
                viewMonth === today.getMonth() &&
                viewYear === today.getFullYear();
              const disabled = isDateDisabled(dateStr);

              return (
                <button
                  key={day}
                  type="button"
                  disabled={disabled}
                  onClick={() => handleSelectDay(day)}
                  className={cn(
                    "h-8 w-full rounded text-sm transition-colors",
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : isToday
                        ? "bg-primary/10 text-primary font-medium"
                        : "hover:bg-gray-100",
                    disabled && "text-gray-300 cursor-not-allowed hover:bg-transparent"
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Today button */}
          <div className="mt-2 border-t pt-2">
            <button
              type="button"
              onClick={() => {
                const m = String(today.getMonth() + 1).padStart(2, "0");
                const d = String(today.getDate()).padStart(2, "0");
                const todayStr = `${today.getFullYear()}-${m}-${d}`;
                onChange(todayStr);
                setViewMonth(today.getMonth());
                setViewYear(today.getFullYear());
                setOpen(false);
              }}
              className="w-full rounded py-1 text-sm text-primary hover:bg-primary/10"
            >
              Hoy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
