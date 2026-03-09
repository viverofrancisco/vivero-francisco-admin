"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

function formatPhoneDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
  return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 9)}`;
}

function toStorageValue(digits: string): string {
  if (!digits) return "";
  return `0${digits}`;
}

function fromStorageValue(value: string): string {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("593")) return digits.slice(3);
  if (digits.startsWith("0")) return digits.slice(1);
  return digits;
}

interface PhoneInputProps {
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  name?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
}

const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ value = "", onChange, onBlur, name, id, className, disabled }, ref) => {
    const digits = fromStorageValue(value);
    const displayValue = formatPhoneDisplay(digits);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(/\D/g, "");
      const limited = raw.slice(0, 9);
      onChange?.(toStorageValue(limited));
    };

    return (
      <div className="flex">
        <span
          className={cn(
            "inline-flex items-center rounded-l-lg border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground select-none",
            disabled && "opacity-50"
          )}
        >
          +593
        </span>
        <input
          ref={ref}
          type="tel"
          id={id}
          name={name}
          value={displayValue}
          onChange={handleChange}
          onBlur={onBlur}
          disabled={disabled}
          placeholder="99 123 4567"
          className={cn(
            "h-8 w-full min-w-0 rounded-r-lg rounded-l-none border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80",
            className
          )}
        />
      </div>
    );
  }
);
PhoneInput.displayName = "PhoneInput";

export { PhoneInput };
