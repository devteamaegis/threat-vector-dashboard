'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase, type AttendanceLog } from '@/lib/supabase'

function timeCalled(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  } catch {
    return '—'
  }
}

export default function AttendancePage() {
  const [logs, setLogs] = useState<AttendanceLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/attendance')
      .then(r => r.json())
      .then(data => setLogs(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false))

    const ch = supabase.channel('attendance-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'attendance_logs' }, payload => {
        setLogs(prev => [payload.new as AttendanceLog, ...prev])
      })
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [])

  const grouped = useMemo(() => {
    return logs.reduce<Record<string, AttendanceLog[]>>((acc, log) => {
      const school = log.school_name || 'Unknown School'
      acc[school] = acc[school] ? [...acc[school], log] : [log]
      return acc
    }, {})
  }, [logs])

  const schoolCount = Object.keys(grouped).length

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.24em] text-red-600">Threat Vector</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Attendance Intake</h1>
          </div>
          <Link href="/" className="rounded-md border border-zinc-300 px-3 py-2 text-xs font-semibold text-zinc-700 transition-colors hover:border-zinc-500 hover:text-zinc-950">
            Command Center
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-6">
        <section className="mb-6 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-medium text-zinc-500">Today</div>
          <div className="mt-1 text-3xl font-bold tracking-tight">
            {logs.length} students absent today across {schoolCount} {schoolCount === 1 ? 'school' : 'schools'}
          </div>
        </section>

        {loading ? (
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} className="mb-3 h-10 animate-pulse rounded bg-zinc-100 last:mb-0" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="rounded-lg border border-zinc-200 bg-white p-10 text-center shadow-sm">
            <div className="text-sm font-medium text-zinc-500">No attendance calls logged today.</div>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([school, schoolLogs]) => (
              <section key={school} className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
                  <h2 className="text-sm font-semibold text-zinc-900">{school}</h2>
                  <span className="text-xs font-medium text-zinc-500">{schoolLogs.length} absent</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-zinc-100 text-[11px] uppercase tracking-wide text-zinc-500">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Student Name</th>
                        <th className="px-4 py-3 font-semibold">Teacher</th>
                        <th className="px-4 py-3 font-semibold">Reason</th>
                        <th className="px-4 py-3 font-semibold">Time Called</th>
                        <th className="px-4 py-3 font-semibold">School</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {schoolLogs.map(log => (
                        <tr key={log.id} className="hover:bg-zinc-50">
                          <td className="px-4 py-3 font-medium text-zinc-950">{log.student_name || 'Unknown student'}</td>
                          <td className="px-4 py-3 text-zinc-700">{log.teacher_name || log.grade || '—'}</td>
                          <td className="px-4 py-3 text-zinc-700">{log.reason || 'Not specified'}</td>
                          <td className="px-4 py-3 text-zinc-500">{timeCalled(log.submitted_at)}</td>
                          <td className="px-4 py-3 text-zinc-700">{school}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
