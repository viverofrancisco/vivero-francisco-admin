"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, Search, X } from "lucide-react";

interface Option {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string | undefined;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  clearable?: boolean;
  className?: string;
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "Seleccionar",
  searchable = false,
  searchPlaceholder = "Buscar...",
  clearable = false,
  className,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const [openAbove, setOpenAbove] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (open && searchable && searchRef.current) {
      searchRef.current.focus();
    }
  }, [open, searchable]);

  const filtered = useMemo(() => {
    if (!searchable || !search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, search, searchable]);

  const selectedLabel = value ? options.find((o) => o.value === value)?.label : undefined;

  const handleSelect = (val: string) => {
    onChange(val);
    setOpen(false);
    setSearch("");
  };

  const handleToggle = () => {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setOpenAbove(spaceBelow < 260);
    }
    setOpen(!open);
    setSearch("");
  };

  return (
    <div ref={ref} className={cn("relative", className)}>
      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-md border bg-background px-3 py-1 text-sm ring-offset-background transition-colors",
          "hover:bg-accent hover:text-accent-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          !value && "text-muted-foreground"
        )}
      >
        <span className="truncate">{selectedLabel ?? placeholder}</span>
        <div className="flex items-center gap-1">
          {clearable && value && (
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
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              open && "rotate-180"
            )}
          />
        </div>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className={cn(
            "absolute z-50 w-full rounded-md border bg-white shadow-lg",
            openAbove ? "bottom-full mb-1" : "top-full mt-1"
          )}
        >
          {searchable && (
            <div className="border-b p-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full rounded-md border bg-background pl-8 pr-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          )}
          <div className="max-h-52 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <p className="py-3 text-center text-sm text-muted-foreground">
                Sin resultados
              </p>
            ) : (
              filtered.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={cn(
                    "flex w-full items-center rounded-md px-2.5 py-1.5 text-sm text-left transition-colors",
                    value === option.value
                      ? "bg-primary/10 text-primary font-medium"
                      : "hover:bg-gray-100"
                  )}
                >
                  {option.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
