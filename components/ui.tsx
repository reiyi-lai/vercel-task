import Link from "next/link";
import type { ReactNode } from "react";

// Small Geist-style primitives shared by every page.

const badgeStyles = {
  gray: "bg-gray-100 text-gray-1000",
  inverted: "bg-gray-1000 text-background-100",
  blue: "bg-blue-200 text-blue-900",
  amber: "bg-amber-200 text-amber-900",
  red: "bg-red-200 text-red-900",
  green: "bg-green-200 text-green-900",
  outline: "bg-background-100 text-gray-1000 shadow-[inset_0_0_0_1px_var(--color-gray-alpha-500)]",
};
export type BadgeVariant = keyof typeof badgeStyles;

export function Badge({ children, variant = "gray" }: { children: ReactNode; variant?: BadgeVariant }) {
  return (
    <span className={`inline-flex h-5 items-center whitespace-nowrap rounded-full px-2 text-label-12 font-medium ${badgeStyles[variant]}`}>
      {children}
    </span>
  );
}

// Vertical as a filled gray pill, product horizontals outlined.

export function Tags({ vertical, horizontals }: { vertical: string; horizontals: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      <Badge>{vertical}</Badge>
      {horizontals.map((h) => <Badge key={h} variant="outline">{h}</Badge>)}
    </div>
  );
}

const dotStyles = { dark: "bg-gray-1000", green: "bg-green-700", amber: "bg-amber-700", red: "bg-red-700", blue: "bg-blue-700", gray: "bg-gray-600", hollow: "border border-gray-700" };
export type DotColor = keyof typeof dotStyles;

// Geist status dot: colour carries status, the text label keeps it readable without colour.
export function Status({ color, children }: { color: DotColor; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-label-13">
      <span aria-hidden className={`size-2 shrink-0 rounded-full ${dotStyles[color]}`} />
      {children}
    </span>
  );
}

// Decorative: the person's name is always shown next to it.
const avatarTones = { gray: "bg-gray-100 text-gray-900 shadow-border", dark: "bg-gray-1000 text-background-100", blue: "bg-blue-200 text-blue-900" };

export function Avatar({ name, size = "md", tone = "gray" }: { name: string; size?: "sm" | "md" | "lg"; tone?: keyof typeof avatarTones }) {
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2);
  const sizes = { sm: "size-6 text-[10px]", md: "size-8 text-label-12", lg: "size-12 text-label-14" };
  return (
    <span aria-hidden className={`inline-flex shrink-0 items-center justify-center rounded-full font-medium ${avatarTones[tone]} ${sizes[size]}`}>
      {initials}
    </span>
  );
}

const buttonStyles = {
  primary: "bg-gray-1000 text-background-100 hover:bg-gray-1000/85",
  secondary: "bg-background-100 shadow-border hover:bg-gray-100",
};

export function Button({ children, variant = "secondary", href, className = "" }: { children: ReactNode; variant?: keyof typeof buttonStyles; href?: string; className?: string }) {
  const classes = `inline-flex h-8 items-center justify-center whitespace-nowrap rounded-lg px-3 text-button-14 ${buttonStyles[variant]} ${className}`;
  return href ? <Link href={href} className={classes}>{children}</Link> : <button type="button" className={classes}>{children}</button>;
}

export function Section({ title, description, aside, children }: { title: ReactNode; description?: ReactNode; aside?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h2 className="text-heading-20">{title}</h2>
          {description && <p className="mt-1 text-copy-14 text-gray-900">{description}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

// Links styled as tabs or a segmented control; the active one carries aria-current.
export function TabLinks({ items, variant = "underline" }: { items: { label: ReactNode; href?: string; active?: boolean }[]; variant?: "underline" | "segmented" }) {
  const styles = {
    underline: { wrap: "flex gap-6", item: "-mb-px border-b-2 pb-3 text-label-14", on: "border-gray-1000", off: "border-transparent text-gray-900" },
    segmented: { wrap: "flex rounded-lg bg-gray-100 p-0.5", item: "flex h-7 items-center rounded-md px-3 text-label-13", on: "bg-background-100 shadow-border font-medium", off: "text-gray-900" },
  }[variant];
  return (
    <nav className={styles.wrap}>
      {items.map((t, i) =>
        t.href ? (
          <Link key={i} href={t.href} scroll={false} aria-current={t.active ? "page" : undefined} className={`${styles.item} ${t.active ? styles.on : `${styles.off} hover:text-gray-1000`}`}>
            {t.label}
          </Link>
        ) : (
          <span key={i} aria-disabled className={`${styles.item} ${styles.off} cursor-not-allowed opacity-60`}>{t.label}</span>
        )
      )}
    </nav>
  );
}

// Full-width page header band, as in the Vercel dashboard. Crumbs without href are plain text (no dead links).
export function PageHeader({ crumbs, children, aside, tabs }: { crumbs: { label: string; href?: string }[]; children: ReactNode; aside?: ReactNode; tabs?: ReactNode }) {
  return (
    <div className="border-b border-gray-alpha-400 bg-background-100">
      <div className="mx-auto max-w-[1200px] px-4 pt-8 sm:px-6">
        <nav aria-label="Breadcrumb" className="text-label-13 text-gray-900">
          {crumbs.map((c, i) => (
            <span key={c.label}>
              {i > 0 && <span aria-hidden className="px-1.5 text-gray-500">/</span>}
              {c.href ? <Link href={c.href} className="hover:text-gray-1000 hover:underline">{c.label}</Link> : c.label}
            </span>
          ))}
        </nav>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-6 pb-6">
          <div className="min-w-0">{children}</div>
          {aside}
        </div>
        {tabs}
      </div>
    </div>
  );
}

export const Page = ({ children }: { children: ReactNode }) => <div className="mx-auto max-w-[1200px] space-y-10 px-4 py-10 sm:px-6">{children}</div>;
