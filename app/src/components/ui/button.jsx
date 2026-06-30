import { forwardRef } from 'react';

const Button = forwardRef(({ className = '', variant, size, ...props }, ref) => {
  const baseStyles = 'inline-flex min-h-11 items-center justify-center border-2 border-black text-xs font-semibold uppercase tracking-widest transition-none focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-black disabled:pointer-events-none disabled:opacity-50';
  
  const variantStyles = variant === 'ghost'
    ? 'bg-white text-black hover:bg-black hover:text-white'
    : 'bg-black text-white hover:bg-white hover:text-black';
  
  const sizeStyles = size === 'icon' ? 'h-11 w-11 p-0' : 'px-5 py-2';

  return (
    <button
      ref={ref}
      className={`${baseStyles} ${variantStyles} ${sizeStyles} ${className}`}
      {...props}
    />
  );
});

Button.displayName = 'Button';

export { Button };
