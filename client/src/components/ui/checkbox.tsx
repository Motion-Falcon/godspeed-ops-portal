import * as React from "react";
import { cn } from "../../lib/utils";
import { Check } from "lucide-react";

export interface CheckboxProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, ...props }, ref) => {
    const [checked, setChecked] = React.useState(props.checked || false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setChecked(e.target.checked);
      if (props.onChange) {
        props.onChange(e);
      }
    };

    return (
      <div className="relative flex items-center">
        <input
          type="checkbox"
          className="peer h-4 w-4 opacity-0 absolute"
          ref={ref}
          checked={checked}
          onChange={handleChange}
          {...props}
        />
        <div
          className={cn(
            "h-4 w-4 shrink-0 rounded-sm border border-primary shadow focus-within:ring-1 ring-offset-background focus-within:ring-ring focus-within:ring-offset-2",
            checked &&
              "bg-primary text-primary-foreground flex items-center justify-center",
            className
          )}
        >
          {checked && <Check className="h-3 w-3 text-current" />}
        </div>
      </div>
    );
  }
);
Checkbox.displayName = "Checkbox";

export { Checkbox }; 