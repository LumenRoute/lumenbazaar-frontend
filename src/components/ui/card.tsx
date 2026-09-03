import { cn } from "@/lib/cn";

type CardProps = {
  children: React.ReactNode;
  className?: string;
};

export function Card({ children, className }: CardProps) {
  return (
    <section className={cn("rounded-lg border border-slate-200 bg-white shadow-sm", className)}>
      {children}
    </section>
  );
}

export function CardHeader({ children, className }: CardProps) {
  return <div className={cn("border-b border-slate-200 px-5 py-4", className)}>{children}</div>;
}

export function CardBody({ children, className }: CardProps) {
  return <div className={cn("px-5 py-4", className)}>{children}</div>;
}
