"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const DIAS_SEMANA = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"];

interface MultiDatePickerProps {
  value: string[];
  onChange: (values: string[]) => void;
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
  return day === 0 ? 6 : day - 1;
}

function formatDisplay(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function MultiDatePicker({
  value,
  onChange,
  placeholder = "Seleccionar fechas",
  minDate,
  maxDate,
  className,
}: MultiDatePickerProps) {
  const [open, setOpen] = useState(false);
  const [openAbove, setOpenAbove] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const today = new Date();
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());
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

  const toggleDate = (day: number) => {
    const m = String(viewMonth + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    const dateStr = `${viewYear}-${m}-${d}`;
    if (isDateDisabled(dateStr)) return;

    if (value.includes(dateStr)) {
      onChange(value.filter((v) => v !== dateStr));
    } else {
      onChange([...value, dateStr].sort());
    }
  };

  const handlePrevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

  const sortedDates = [...value].sort();

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
            setOpenAbove(spaceBelow < 400);
          }
          setOpen(!open);
        }}
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-md border bg-background px-3 py-1 text-sm ring-offset-background transition-colors",
          "hover:bg-accent hover:text-accent-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          value.length === 0 && "text-muted-foreground"
        )}
      >
        <span className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          {value.length === 0
            ? placeholder
            : `${value.length} fecha${value.length !== 1 ? "s" : ""} seleccionada${value.length !== 1 ? "s" : ""}`}
        </span>
        {value.length > 0 && (
          <span
            onClick={(e) => { e.stopPropagation(); onChange([]); }}
            className="rounded p-0.5 hover:bg-gray-200"
          >
            <X className="h-3 w-3 text-muted-foreground" />
          </span>
        )}
      </button>

      {/* Selected dates badges */}
      {sortedDates.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {sortedDates.map((d) => (
            <span
              key={d}
              className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
            >
              {formatDisplay(d)}
              <button
                type="button"
                onClick={() => onChange(value.filter((v) => v !== d))}
                className="rounded-full hover:bg-primary/20 p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Dropdown calendar */}
      {open && (
        <div className={cn(
          "absolute z-50 w-72 rounded-md border bg-white p-3 shadow-lg",
          openAbove ? "bottom-full mb-1" : "top-full mt-1"
        )}>
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={handlePrevMonth} className="rounded p-1 hover:bg-gray-100">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-1">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => { setShowMonthSelect(!showMonthSelect); setShowYearSelect(false); }}
                  className="rounded px-2 py-1 text-sm font-medium hover:bg-gray-100"
                >
                  {MESES[viewMonth]}
                </button>
                {showMonthSelect && (
                  <div className="absolute top-full left-0 z-10 mt-1 max-h-48 w-36 overflow-y-auto rounded-md border bg-white shadow-lg">
                    {MESES.map((mes, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => { setViewMonth(i); setShowMonthSelect(false); }}
                        className={cn(
                          "flex w-full px-3 py-1.5 text-sm hover:bg-gray-50 text-left",
                          viewMonth === i && "bg-primary/10 text-primary font-medium"
                        )}
                      >
                        {mes}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => { setShowYearSelect(!showYearSelect); setShowMonthSelect(false); }}
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
                        onClick={() => { setViewYear(y); setShowYearSelect(false); }}
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
            <button type="button" onClick={handleNextMonth} className="rounded p-1 hover:bg-gray-100">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 gap-0 mb-1">
            {DIAS_SEMANA.map((d) => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-0">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="h-8" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const m = String(viewMonth + 1).padStart(2, "0");
              const d = String(day).padStart(2, "0");
              const dateStr = `${viewYear}-${m}-${d}`;
              const isSelected = value.includes(dateStr);
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
                  onClick={() => toggleDate(day)}
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
        </div>
      )}
    </div>
  );
}
