import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export interface CustomSelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  options?: Array<SelectOption | [string, string] | string>;
  emptyOption?: string | null;
  children?: React.ReactNode;
}

export const CustomSelect = React.forwardRef<HTMLSelectElement, CustomSelectProps>(
  ({ className, options, emptyOption, children, disabled, value, onChange, ...props }, ref) => {
    return (
      <div className="relative w-full">
        <select
          ref={ref}
          value={value}
          onChange={onChange}
          disabled={disabled}
          className={cn(
            "h-10 w-full appearance-none rounded-xl border border-input bg-background/90 ps-3.5 pe-9 text-sm font-medium shadow-xs outline-none transition-all",
            "hover:border-foreground/20 focus:border-ring focus:ring-2 focus:ring-ring/20",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "dark:bg-input/20 dark:hover:bg-input/30",
            className
          )}
          {...props}
        >
          {emptyOption !== undefined && emptyOption !== null && (
            <option value="">{emptyOption}</option>
          )}
          {options
            ? options.map((opt) => {
                if (typeof opt === "string") {
                  return (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  );
                }
                if (Array.isArray(opt)) {
                  const [val, label] = opt;
                  return (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  );
                }
                return (
                  <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                    {opt.label}
                  </option>
                );
              })
            : children}
        </select>
        <ChevronDown className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition-transform" />
      </div>
    );
  }
);

CustomSelect.displayName = "CustomSelect";
