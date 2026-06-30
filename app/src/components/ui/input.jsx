import { forwardRef } from 'react';

const Input = forwardRef(({ className = '', ...props }, ref) => (
  <input
    ref={ref}
    className={`finance-input ${className}`}
    {...props}
  />
));

Input.displayName = 'Input';

export { Input };
