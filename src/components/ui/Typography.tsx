import React from "react";
import { cn } from "@/lib/cn";

type AsProp<T extends React.ElementType> = {
  as?: T;
};

type PolymorphicComponentProps<T extends React.ElementType, Props> = 
  Props & AsProp<T> & Omit<React.ComponentPropsWithoutRef<T>, keyof Props | "as">;

interface BaseTypographyProps {
  children: React.ReactNode;
  className?: string;
}

export function Display<T extends React.ElementType = "h1">({
  as,
  children,
  className,
  ...props
}: PolymorphicComponentProps<T, BaseTypographyProps>) {
  const Component = as || "h1";
  return (
    <Component
      className={cn(
        "text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl select-none",
        className
      )}
      {...props}
    >
      {children}
    </Component>
  );
}

export function Heading<T extends React.ElementType = "h2">({
  as,
  children,
  className,
  ...props
}: PolymorphicComponentProps<T, BaseTypographyProps>) {
  const Component = as || "h2";
  return (
    <Component
      className={cn(
        "text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl",
        className
      )}
      {...props}
    >
      {children}
    </Component>
  );
}

export function Title<T extends React.ElementType = "h3">({
  as,
  children,
  className,
  ...props
}: PolymorphicComponentProps<T, BaseTypographyProps>) {
  const Component = as || "h3";
  return (
    <Component
      className={cn(
        "text-lg font-semibold tracking-tight text-foreground sm:text-xl lg:text-2xl",
        className
      )}
      {...props}
    >
      {children}
    </Component>
  );
}

export function Subtitle<T extends React.ElementType = "p">({
  as,
  children,
  className,
  ...props
}: PolymorphicComponentProps<T, BaseTypographyProps>) {
  const Component = as || "p";
  return (
    <Component
      className={cn(
        "text-sm font-medium text-foreground/60 sm:text-base lg:text-lg",
        className
      )}
      {...props}
    >
      {children}
    </Component>
  );
}

export function Body<T extends React.ElementType = "p">({
  as,
  children,
  className,
  ...props
}: PolymorphicComponentProps<T, BaseTypographyProps>) {
  const Component = as || "p";
  return (
    <Component
      className={cn(
        "text-xs font-normal text-foreground/80 leading-relaxed sm:text-sm lg:text-base",
        className
      )}
      {...props}
    >
      {children}
    </Component>
  );
}

export function Caption<T extends React.ElementType = "span">({
  as,
  children,
  className,
  ...props
}: PolymorphicComponentProps<T, BaseTypographyProps>) {
  const Component = as || "span";
  return (
    <Component
      className={cn(
        "text-[10px] font-normal text-foreground/50 sm:text-xs lg:text-sm",
        className
      )}
      {...props}
    >
      {children}
    </Component>
  );
}

export function Label<T extends React.ElementType = "label">({
  as,
  children,
  className,
  ...props
}: PolymorphicComponentProps<T, BaseTypographyProps>) {
  const Component = as || "label";
  return (
    <Component
      className={cn(
        "text-xs font-medium text-foreground/90 select-none sm:text-sm",
        className
      )}
      {...props}
    >
      {children}
    </Component>
  );
}

export function Overline<T extends React.ElementType = "span">({
  as,
  children,
  className,
  ...props
}: PolymorphicComponentProps<T, BaseTypographyProps>) {
  const Component = as || "span";
  return (
    <Component
      className={cn(
        "text-[10px] font-semibold uppercase tracking-wider text-brand-primary sm:text-xs",
        className
      )}
      {...props}
    >
      {children}
    </Component>
  );
}
