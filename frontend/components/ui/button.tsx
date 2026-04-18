import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

const variantStyles = {
  primary:
    'bg-slate-950 text-white shadow-soft hover:bg-slate-800 focus-visible:outline-cyan-600 disabled:bg-slate-300 disabled:text-slate-500',
  secondary:
    'border border-white/80 bg-white/92 text-slate-900 shadow-soft hover:bg-white focus-visible:outline-cyan-600 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400',
  soft: 'border border-white/70 bg-white/72 text-slate-900 shadow-soft hover:bg-white/88 focus-visible:outline-cyan-600 disabled:bg-white/50 disabled:text-slate-400',
  ghost:
    'bg-transparent text-slate-700 hover:bg-white/70 focus-visible:outline-cyan-600 disabled:text-slate-400',
} as const;

const sizeStyles = {
  sm: 'h-11 rounded-[20px] px-4 text-sm',
  md: 'h-12 rounded-[22px] px-4 text-sm',
  lg: 'h-14 rounded-[24px] px-5 text-base',
  icon: 'h-11 w-11 rounded-[20px] text-sm',
} as const;

type ButtonStyleOptions = {
  variant?: keyof typeof variantStyles;
  size?: keyof typeof sizeStyles;
  fullWidth?: boolean;
  className?: string;
};

export function buttonStyles({
  variant = 'primary',
  size = 'lg',
  fullWidth = false,
  className,
}: ButtonStyleOptions = {}) {
  return cn(
    'inline-flex touch-manipulation items-center justify-center gap-2 font-semibold transition duration-200 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.99]',
    variantStyles[variant],
    sizeStyles[size],
    fullWidth ? 'w-full' : undefined,
    className,
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & ButtonStyleOptions;

export function Button({
  className,
  variant = 'primary',
  size = 'lg',
  fullWidth = false,
  type = 'button',
  ...props
}: ButtonProps) {
  return <button type={type} className={buttonStyles({ variant, size, fullWidth, className })} {...props} />;
}
