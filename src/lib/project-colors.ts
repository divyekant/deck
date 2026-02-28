export interface ProjectColor {
  name: string
  bg: string
  text: string
  border: string
  borderLeft: string
  borderTop: string
  dot: string
  bar: string
}

const PALETTE: ProjectColor[] = [
  {
    name: "emerald",
    bg: "bg-emerald-950",
    text: "text-emerald-400",
    border: "border-emerald-800",
    borderLeft: "border-l-emerald-500",
    borderTop: "border-t-emerald-500",
    dot: "bg-emerald-500",
    bar: "bg-emerald-500",
  },
  {
    name: "blue",
    bg: "bg-blue-950",
    text: "text-blue-400",
    border: "border-blue-800",
    borderLeft: "border-l-blue-500",
    borderTop: "border-t-blue-500",
    dot: "bg-blue-500",
    bar: "bg-blue-500",
  },
  {
    name: "violet",
    bg: "bg-violet-950",
    text: "text-violet-400",
    border: "border-violet-800",
    borderLeft: "border-l-violet-500",
    borderTop: "border-t-violet-500",
    dot: "bg-violet-500",
    bar: "bg-violet-500",
  },
  {
    name: "amber",
    bg: "bg-amber-950",
    text: "text-amber-400",
    border: "border-amber-800",
    borderLeft: "border-l-amber-500",
    borderTop: "border-t-amber-500",
    dot: "bg-amber-500",
    bar: "bg-amber-500",
  },
  {
    name: "rose",
    bg: "bg-rose-950",
    text: "text-rose-400",
    border: "border-rose-800",
    borderLeft: "border-l-rose-500",
    borderTop: "border-t-rose-500",
    dot: "bg-rose-500",
    bar: "bg-rose-500",
  },
  {
    name: "cyan",
    bg: "bg-cyan-950",
    text: "text-cyan-400",
    border: "border-cyan-800",
    borderLeft: "border-l-cyan-500",
    borderTop: "border-t-cyan-500",
    dot: "bg-cyan-500",
    bar: "bg-cyan-500",
  },
  {
    name: "orange",
    bg: "bg-orange-950",
    text: "text-orange-400",
    border: "border-orange-800",
    borderLeft: "border-l-orange-500",
    borderTop: "border-t-orange-500",
    dot: "bg-orange-500",
    bar: "bg-orange-500",
  },
  {
    name: "pink",
    bg: "bg-pink-950",
    text: "text-pink-400",
    border: "border-pink-800",
    borderLeft: "border-l-pink-500",
    borderTop: "border-t-pink-500",
    dot: "bg-pink-500",
    bar: "bg-pink-500",
  },
  {
    name: "lime",
    bg: "bg-lime-950",
    text: "text-lime-400",
    border: "border-lime-800",
    borderLeft: "border-l-lime-500",
    borderTop: "border-t-lime-500",
    dot: "bg-lime-500",
    bar: "bg-lime-500",
  },
  {
    name: "indigo",
    bg: "bg-indigo-950",
    text: "text-indigo-400",
    border: "border-indigo-800",
    borderLeft: "border-l-indigo-500",
    borderTop: "border-t-indigo-500",
    dot: "bg-indigo-500",
    bar: "bg-indigo-500",
  },
]

export function getProjectColor(projectName: string): ProjectColor {
  let hash = 0
  for (let i = 0; i < projectName.length; i++) {
    hash += projectName.charCodeAt(i)
  }
  return PALETTE[hash % PALETTE.length]
}
