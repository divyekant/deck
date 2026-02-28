"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

const STORAGE_KEY = "deck-onboarded"

const steps = [
  {
    number: 1,
    title: "Install Claude Code",
    description: "Get the Claude Code CLI from Anthropic",
  },
  {
    number: 2,
    title: "Run some sessions",
    description: "Use Claude Code on your projects as usual",
  },
  {
    number: 3,
    title: "Watch Deck light up",
    description: "Deck automatically detects your session data",
  },
]

export default function Onboarding() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof window !== "undefined") {
      const dismissed = localStorage.getItem(STORAGE_KEY)
      if (!dismissed) {
        setVisible(true)
      }
    }
  }, [])

  if (!visible) return null

  function handleDismiss() {
    localStorage.setItem(STORAGE_KEY, "true")
    setVisible(false)
  }

  return (
    <Card className="relative overflow-hidden border-zinc-800 bg-zinc-900">
      <CardContent className="relative z-10 pt-0">
        {/* Heading */}
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-zinc-50">
            Welcome to Deck{" "}
            <span role="img" aria-label="wave">
              👋
            </span>
          </h2>
          <p className="mt-2 text-sm text-zinc-400">
            Your personal Claude Code analytics dashboard
          </p>
        </div>

        {/* Steps */}
        <div className="mx-auto mt-8 flex max-w-lg flex-col gap-0">
          {steps.map((step, i) => (
            <div key={step.number} className="flex gap-4">
              {/* Number column with connecting line */}
              <div className="flex flex-col items-center">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-sm font-semibold text-emerald-400">
                  {step.number}
                </div>
                {i < steps.length - 1 && (
                  <div className="my-1 w-px flex-1 bg-zinc-700" />
                )}
              </div>

              {/* Text */}
              <div className={i < steps.length - 1 ? "pb-6" : ""}>
                <p className="text-sm font-medium text-zinc-200">
                  {step.title}
                </p>
                <p className="mt-0.5 text-sm text-zinc-500">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Buttons */}
        <div className="mt-8 flex items-center justify-center gap-3">
          <Button asChild>
            <Link href="/about">Explore Deck</Link>
          </Button>
          <Button variant="outline" onClick={handleDismiss}>
            Dismiss
          </Button>
        </div>
      </CardContent>

      {/* CSS-only animated particles */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <style>{`
          @keyframes deck-float-1 {
            0%, 100% { transform: translate(0, 0); opacity: 0.15; }
            50% { transform: translate(12px, -18px); opacity: 0.4; }
          }
          @keyframes deck-float-2 {
            0%, 100% { transform: translate(0, 0); opacity: 0.1; }
            50% { transform: translate(-10px, -22px); opacity: 0.35; }
          }
          @keyframes deck-float-3 {
            0%, 100% { transform: translate(0, 0); opacity: 0.2; }
            50% { transform: translate(8px, -14px); opacity: 0.45; }
          }
          @keyframes deck-float-4 {
            0%, 100% { transform: translate(0, 0); opacity: 0.12; }
            50% { transform: translate(-14px, -16px); opacity: 0.3; }
          }
          @keyframes deck-float-5 {
            0%, 100% { transform: translate(0, 0); opacity: 0.18; }
            50% { transform: translate(6px, -20px); opacity: 0.38; }
          }
        `}</style>
        <div
          className="absolute size-2 rounded-full bg-emerald-400"
          style={{ bottom: "20%", left: "12%", animation: "deck-float-1 4s ease-in-out infinite" }}
        />
        <div
          className="absolute size-1.5 rounded-full bg-emerald-500"
          style={{ bottom: "30%", left: "28%", animation: "deck-float-2 5s ease-in-out infinite 0.8s" }}
        />
        <div
          className="absolute size-2.5 rounded-full bg-emerald-400"
          style={{ bottom: "15%", right: "22%", animation: "deck-float-3 4.5s ease-in-out infinite 1.5s" }}
        />
        <div
          className="absolute size-1.5 rounded-full bg-emerald-500"
          style={{ bottom: "25%", right: "10%", animation: "deck-float-4 5.5s ease-in-out infinite 0.3s" }}
        />
        <div
          className="absolute size-2 rounded-full bg-emerald-400"
          style={{ bottom: "35%", left: "50%", animation: "deck-float-5 4.8s ease-in-out infinite 2s" }}
        />
      </div>
    </Card>
  )
}
