import type { LucideIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface StatsCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: LucideIcon
}

export function StatsCard({ title, value, subtitle, icon: Icon }: StatsCardProps) {
  return (
    <Card className="relative">
      <CardContent className="pt-0">
        {Icon && (
          <div className="absolute right-5 top-5">
            <Icon className="size-5 text-zinc-500" />
          </div>
        )}
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
        <p className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
          {value}
        </p>
        {subtitle && (
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  )
}
