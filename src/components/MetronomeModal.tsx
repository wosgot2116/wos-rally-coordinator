import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useState } from 'react'

type MetronomeModalProps = {
  isOpen: boolean
  isRunning: boolean
  beatsPerMinute: number
  onlyPlayWhenScriptRunning: boolean
  onClose: () => void
  onStart: () => void
  onStop: () => void
  onChangeBeatsPerMinute: (value: number) => void
  onToggleOnlyPlayWhenScriptRunning: (value: boolean) => void
}

const MIN_BPM = 30
const MAX_BPM = 300
const STEP = 1

export function MetronomeModal({
  isOpen,
  isRunning,
  beatsPerMinute,
  onlyPlayWhenScriptRunning,
  onClose,
  onStart,
  onStop,
  onChangeBeatsPerMinute,
  onToggleOnlyPlayWhenScriptRunning,
}: MetronomeModalProps) {
  const prefersReducedMotion = useReducedMotion()
  const [manualInput, setManualInput] = useState(String(Math.round(beatsPerMinute)))

  useEffect(() => {
    setManualInput(String(Math.round(beatsPerMinute)))
  }, [beatsPerMinute])

  const duration = prefersReducedMotion ? 0 : 0.22
  const ease = [0.22, 1, 0.36, 1] as const
  const panelDrop = prefersReducedMotion ? 0 : -28

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          key="metronome-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="metronome-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 px-4 py-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration, ease }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose()
          }}
        >
          <motion.div
            className="w-full max-w-lg rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl"
            initial={{ opacity: 0, y: panelDrop }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: prefersReducedMotion ? 0 : -12 }}
            transition={{ duration, ease }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="metronome-title" className="text-lg font-semibold text-zinc-100">
                  Metronome
                </h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Set the beat rate and start or stop the click track.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-zinc-600 bg-zinc-900/80 px-3 py-1.5 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
              >
                Close
              </button>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onStart}
                disabled={isRunning}
                className="min-w-28 rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400 disabled:pointer-events-none disabled:opacity-50"
              >
                On
              </button>
              <button
                type="button"
                onClick={onStop}
                disabled={!isRunning}
                className="min-w-28 rounded-lg border border-zinc-600 bg-zinc-900/80 px-5 py-2.5 text-sm font-semibold text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800 disabled:pointer-events-none disabled:opacity-50"
              >
                Off
              </button>
              <label className="inline-flex cursor-pointer select-none items-center gap-2.5 rounded-lg border border-zinc-600 bg-zinc-900/80 px-5 py-2.5 text-sm font-semibold text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-amber-300">
                <input
                  type="checkbox"
                  checked={onlyPlayWhenScriptRunning}
                  onChange={(e) => onToggleOnlyPlayWhenScriptRunning(e.target.checked)}
                  className="size-4 shrink-0 rounded border-zinc-600 bg-zinc-950 text-amber-500 focus:ring-amber-500/50"
                />
                Only play while script is running
              </label>
            </div>

            <div className="mt-6 space-y-3">
              <label
                htmlFor="metronome-slider"
                className="text-sm font-semibold uppercase tracking-[0.15em] text-zinc-400"
              >
                Beats per minute (BPM)
              </label>
              <input
                id="metronome-slider"
                type="range"
                min={MIN_BPM}
                max={MAX_BPM}
                step={STEP}
                value={beatsPerMinute}
                onChange={(e) => onChangeBeatsPerMinute(Number(e.target.value))}
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-zinc-700 accent-amber-500"
              />
              <div className="flex items-center justify-between gap-4">
                <input
                  type="number"
                  min={MIN_BPM}
                  max={MAX_BPM}
                  step={STEP}
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  onBlur={() => onChangeBeatsPerMinute(Number(manualInput))}
                  className="w-32 rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-sm font-medium text-zinc-100 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                />
                <span className="text-sm text-zinc-400">
                  {Math.round(beatsPerMinute)} BPM
                </span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
