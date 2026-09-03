import { cn } from "@/lib/cn";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
  danger: "border-red-700 bg-red-700 text-white hover:bg-red-800",
  ghost: "border-transparent bg-transparent text-slate-700 hover:bg-slate-100",
  primary: "border-teal-700 bg-teal-700 text-white hover:bg-teal-800",
  secondary: "border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
