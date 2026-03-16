import * as React from "react";
import { cn } from "@/lib/utils";

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value: string | number;
  onValueChange: (rawValue: string) => void;
  prefix?: string;
  decimals?: number;
}

function formatCurrencyValue(raw: string, decimals: number): string {
  // Remove everything except digits
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";

  // Pad to ensure at least decimals+1 digits
  const padded = digits.padStart(decimals + 1, "0");
  const intPart = padded.slice(0, padded.length - decimals);
  const decPart = padded.slice(padded.length - decimals);

  // Remove leading zeros from integer part (but keep at least one digit)
  const cleanInt = intPart.replace(/^0+/, "") || "0";

  // Add thousand separators (dots)
  const withDots = cleanInt.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  return decimals > 0 ? `${withDots},${decPart}` : withDots;
}

function toRawNumber(formatted: string, decimals: number): string {
  const digits = formatted.replace(/\D/g, "");
  if (!digits) return "0";
  const padded = digits.padStart(decimals + 1, "0");
  const intPart = padded.slice(0, padded.length - decimals);
  const decPart = padded.slice(padded.length - decimals);
  const cleanInt = intPart.replace(/^0+/, "") || "0";
  return decimals > 0 ? `${cleanInt}.${decPart}` : cleanInt;
}

const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ className, value, onValueChange, prefix = "$ ", decimals = 2, ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState("");

    // Sync display from external value
    React.useEffect(() => {
      const numStr = String(value || "0");
      // Convert "1234.56" to digits "123456"
      const parts = numStr.split(".");
      const intDigits = (parts[0] || "0").replace(/\D/g, "");
      const decDigits = (parts[1] || "").replace(/\D/g, "").padEnd(decimals, "0").slice(0, decimals);
      const allDigits = intDigits + decDigits;
      const formatted = formatCurrencyValue(allDigits, decimals);
      setDisplayValue(formatted);
    }, [value, decimals]);

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const rawInput = e.target.value.replace(/[^0-9]/g, "");
      const formatted = formatCurrencyValue(rawInput, decimals);
      setDisplayValue(formatted);
      onValueChange(toRawNumber(formatted, decimals));
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
      // Allow: backspace, delete, tab, escape, enter, arrows
      const allowed = ["Backspace", "Delete", "Tab", "Escape", "Enter", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"];
      if (allowed.includes(e.key)) return;
      // Allow Ctrl/Cmd+A, C, V, X
      if ((e.ctrlKey || e.metaKey) && ["a", "c", "v", "x"].includes(e.key.toLowerCase())) return;
      // Only allow digits
      if (!/^\d$/.test(e.key)) {
        e.preventDefault();
      }
    }

    return (
      <div className="relative">
        {prefix && (
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none select-none">
            {prefix}
          </span>
        )}
        <input
          ref={ref}
          type="text"
          inputMode="numeric"
          className={cn(
            "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            prefix ? "pl-7" : "",
            className
          )}
          value={displayValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          {...props}
        />
      </div>
    );
  }
);
CurrencyInput.displayName = "CurrencyInput";

export { CurrencyInput, formatCurrencyValue, toRawNumber };
