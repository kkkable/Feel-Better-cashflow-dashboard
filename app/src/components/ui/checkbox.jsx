import { forwardRef } from 'react';
import { Check } from 'lucide-react';

const Checkbox = forwardRef(({ className = '', checked, onCheckedChange, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    role="checkbox"
    aria-checked={checked}
    onClick={() => onCheckedChange?.(!checked)}
    className={`flex h-5 w-5 shrink-0 items-center justify-center border-2 border-black shadow-none focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-black disabled:cursor-not-allowed disabled:opacity-50 ${checked ? 'bg-black text-white' : 'bg-white text-black'} ${className}`}
    {...props}
  >
    {checked && <Check className="h-3.5 w-3.5" strokeWidth={2} />}
  </button>
));

Checkbox.displayName = 'Checkbox';

export { Checkbox };
