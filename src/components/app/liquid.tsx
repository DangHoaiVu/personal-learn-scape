import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type PointerBindings<T extends HTMLElement> = {
  onPointerMove: (event: React.PointerEvent<T>) => void;
  onPointerLeave: (event: React.PointerEvent<T>) => void;
};

export function useLiquidPointer<T extends HTMLElement>(): PointerBindings<T> {
  const frame = React.useRef<number | null>(null);
  const last = React.useRef<{ element: T; x: number; y: number } | null>(null);

  const flush = React.useCallback(() => {
    frame.current = null;
    const point = last.current;
    if (!point) return;
    const rect = point.element.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, point.x - rect.left));
    const y = Math.max(0, Math.min(rect.height, point.y - rect.top));
    point.element.style.setProperty("--liquid-pointer-x", `${x}px`);
    point.element.style.setProperty("--liquid-pointer-y", `${y}px`);
    point.element.style.setProperty(
      "--liquid-pointer-x-percent",
      `${(x / Math.max(rect.width, 1)) * 100}%`,
    );
    point.element.style.setProperty(
      "--liquid-pointer-y-percent",
      `${(y / Math.max(rect.height, 1)) * 100}%`,
    );
  }, []);

  React.useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  const onPointerMove = React.useCallback(
    (event: React.PointerEvent<T>) => {
      if (
        event.pointerType === "touch" ||
        !window.matchMedia("(hover: hover) and (pointer: fine)").matches
      )
        return;
      last.current = { element: event.currentTarget, x: event.clientX, y: event.clientY };
      if (frame.current === null) frame.current = requestAnimationFrame(flush);
    },
    [flush],
  );

  const onPointerLeave = React.useCallback((event: React.PointerEvent<T>) => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    last.current = null;
    for (const variable of [
      "--liquid-pointer-x",
      "--liquid-pointer-y",
      "--liquid-pointer-x-percent",
      "--liquid-pointer-y-percent",
    ]) {
      event.currentTarget.style.removeProperty(variable);
    }
  }, []);

  return { onPointerMove, onPointerLeave };
}

type SharedContextValue = {
  activeValue: string | null;
};
const SharedContext = React.createContext<SharedContextValue | null>(null);

type SharedRootProps = React.HTMLAttributes<HTMLDivElement> & { value: string | null };

function SharedRoot({ value, className, children, ...props }: SharedRootProps) {
  return (
    <SharedContext.Provider value={{ activeValue: value }}>
      <div className={cn("liquid-shared-root", className)} {...props}>
        {children}
      </div>
    </SharedContext.Provider>
  );
}

export function LiquidNav(props: SharedRootProps) {
  return <SharedRoot {...props} className={cn("liquid-nav", props.className)} />;
}

export function LiquidSegmentedControl(props: SharedRootProps) {
  return (
    <SharedRoot
      {...props}
      role={props.role ?? "tablist"}
      className={cn("liquid-segmented", props.className)}
    />
  );
}

type SharedItemProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  value: string;
  asChild?: boolean;
};

function SharedItem({ value, asChild, className, children, ...props }: SharedItemProps) {
  const context = React.useContext(SharedContext);
  const selected = context?.activeValue === value;
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      type={asChild ? undefined : (props.type ?? "button")}
      data-liquid-item=""
      data-selected={selected ? "true" : "false"}
      aria-selected={props.role === "tab" ? selected : props["aria-selected"]}
      className={cn("liquid-shared-item", className)}
      {...props}
    >
      {children}
    </Comp>
  );
}

export function LiquidNavItem(props: SharedItemProps) {
  return <SharedItem {...props} className={cn("liquid-nav-item", props.className)} />;
}

export function LiquidSegmentedItem(props: SharedItemProps) {
  return (
    <SharedItem
      {...props}
      role={props.role ?? "tab"}
      className={cn("liquid-segmented-item", props.className)}
    />
  );
}

export type LiquidButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive" | "link";
  size?: "sm" | "default" | "lg" | "icon";
  loading?: boolean;
  success?: boolean;
  error?: boolean;
};

export const LiquidButton = React.forwardRef<HTMLButtonElement, LiquidButtonProps>(
  (
    {
      asChild,
      variant = "default",
      size = "default",
      loading,
      success,
      error,
      disabled,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";
    const pointer = useLiquidPointer<HTMLElement>();
    const sharedProps = {
      "data-liquid-button": "",
      "data-variant": variant,
      "data-size": size,
      "data-success": success || undefined,
      "data-error": error || undefined,
      "aria-busy": loading || undefined,
      className: cn("liquid-button", className),
    };

    if (asChild) {
      return (
        <Slot ref={ref} {...sharedProps} {...pointer} {...props}>
          {children}
        </Slot>
      );
    }

    return (
      <Comp
        ref={ref}
        type={props.type ?? "button"}
        {...sharedProps}
        disabled={disabled || loading}
        {...pointer}
        {...props}
      >
        {loading ? <Loader2 aria-hidden="true" className="liquid-spinner" /> : null}
        <span className={cn("liquid-button-content", loading && "liquid-content-loading")}>
          {children}
        </span>
      </Comp>
    );
  },
);
LiquidButton.displayName = "LiquidButton";

export const LiquidIconButton = React.forwardRef<HTMLButtonElement, LiquidButtonProps>(
  ({ className, size = "icon", ...props }, ref) => (
    <LiquidButton
      ref={ref}
      size={size}
      className={cn("liquid-icon-button", className)}
      {...props}
    />
  ),
);
LiquidIconButton.displayName = "LiquidIconButton";

export { Slider as LiquidSlider } from "@/components/ui/slider";
