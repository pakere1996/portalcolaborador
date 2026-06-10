"use client";

import { Link } from "react-router-dom";
import { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface NavigationCardProps {
  to: string;
  title: string;
  description: string;
  icon: LucideIcon;
  className?: string;
}

export function NavigationCard({ to, title, description, icon: Icon, className }: NavigationCardProps) {
  return (
    <Link to={to} className={cn("block h-full", className)}>
      <Card className="h-full transition-all duration-200 hover:shadow-lg hover:border-primary/50 border-2 border-border">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg font-semibold text-primary">{title}</CardTitle>
          <Icon className="size-6 text-yellow-500" />
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{description}</p>
        </CardContent>
      </Card>
    </Link>
  );
}