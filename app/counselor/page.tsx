'use client'

import { useState, FormEvent } from 'react'

const RAILWAY_BASE = 'https://threat-vector-production.up.railway.app'

type SubmitState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'escalation'; reason: string; note_count: number; tip_count: number }
  | { status: 'ok' }
  | { status: 'error'; message: string }

export default function CounselorPage() {
  const [schoolName, setSchoolName]         = useState('')
  const [studentIdHash, setStudentIdHash]   = useState('')
  const [noteText, setNoteText]             = useState('')
  const [severity, setSeverity]             = useState<'low' | 'medium' | 'high'>('medium')
  const [staffId, setStaffId]               = useState('')
  const [state, setState]                   = useState<SubmitState>({ status: 'idle' })

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setState({ status: 'loading' })

    try {
      const res = await fetch(`${RAILWAY_BASE}/api/counselor/note`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          school_name:      schoolName.trim(),
          student_id_hash:  studentIdHash.trim(),
          note_text:        noteText.trim(),
          severity,
          staff_id:         staffId.trim(),
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setState({ status: 'error', message: (err as { error?: string }).error ?? `HTTP ${res.status}` })
        return
      }

      const data = await res.json() as {
        escalate: boolean
        reason: string
        note_count: number
        tip_count: number
      }

      if (data.escalate) {
        setState({
          status:     'escalation',
          reason:     data.reason,
          note_count: data.note_count,
          tip_count:  data.tip_count,
        })
      } else {
        setState({ status: 'ok' })
        // Reset form
        setSchoolName('')
        setStudentIdHash('')
        setNoteText('')
        setSeverity('medium')
        setStaffId('')
      }
    } catch (err) {
      setState({ status: 'error', message: String(err) })
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--surface-2)',
    color: 'var(--foreground)',
    fontSize: 13,
    fontFamily: 'var(--font-roboto-slab), "Roboto Slab", Georgia, serif',
    outline: 'none',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: 'var(--muted)',
    marginBottom: 6,
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--background)',
        color: 'var(--foreground)',
        fontFamily: 'var(--font-roboto-slab), "Roboto Slab", Georgia, serif',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '48px 16px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 520 }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <a
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              color: 'var(--muted)',
              textDecoration: 'none',
              marginBottom: 20,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            ← Back to Dashboard
          </a>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 900,
              letterSpacing: '0.04em',
              color: 'var(--foreground)',
              margin: 0,
            }}
          >
            Counselor Case Notes
          </h1>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>
            Log confidential notes and monitor escalation patterns across tips and prior notes.
          </p>
        </div>

        {/* Card */}
        <form
          onSubmit={handleSubmit}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 28,
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          {/* School name */}
          <div>
            <label style={labelStyle}>School Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Westbrook Academy"
              value={schoolName}
              onChange={e => setSchoolName(e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* Student ID hash */}
          <div>
            <label style={labelStyle}>Anonymous Student ID</label>
            <input
              type="text"
              required
              placeholder="e.g. sha256-a3f8..."
              value={studentIdHash}
              onChange={e => setStudentIdHash(e.target.value)}
              style={inputStyle}
            />
            <p style={{ fontSize: 10, color: 'var(--muted-2)', marginTop: 4 }}>
              Use a hashed or anonymised identifier — never the student&apos;s real name.
            </p>
          </div>

          {/* Note text */}
          <div>
            <label style={labelStyle}>Note</label>
            <textarea
              required
              rows={5}
              placeholder="Describe the concern, observed behaviour, or follow-up action…"
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          {/* Severity */}
          <div>
            <label style={labelStyle}>Severity</label>
            <select
              value={severity}
              onChange={e => setSeverity(e.target.value as 'low' | 'medium' | 'high')}
              style={inputStyle}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          {/* Staff ID */}
          <div>
            <label style={labelStyle}>Staff ID</label>
            <input
              type="text"
              required
              placeholder="e.g. counselor-042"
              value={staffId}
              onChange={e => setStaffId(e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* Result banners */}
          {state.status === 'escalation' && (
            <div
              style={{
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.4)',
                borderRadius: 8,
                padding: '14px 16px',
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: '#ef4444',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  marginBottom: 6,
                }}
              >
                ⚠ ESCALATION PATTERN DETECTED
              </div>
              <p style={{ fontSize: 13, color: 'var(--foreground)', margin: 0 }}>
                {state.reason}
              </p>
              <div
                style={{
                  display: 'flex',
                  gap: 16,
                  marginTop: 10,
                  fontSize: 11,
                  color: 'var(--muted)',
                }}
              >
                <span>Tips from school: <strong style={{ color: 'var(--foreground)' }}>{state.tip_count}</strong></span>
                <span>Notes for student: <strong style={{ color: 'var(--foreground)' }}>{state.note_count}</strong></span>
              </div>
            </div>
          )}

          {state.status === 'ok' && (
            <div
              style={{
                background: 'rgba(16,185,129,0.08)',
                border: '1px solid rgba(16,185,129,0.3)',
                borderRadius: 8,
                padding: '12px 16px',
                fontSize: 13,
                color: '#10b981',
                fontWeight: 600,
              }}
            >
              Note logged successfully.
            </div>
          )}

          {state.status === 'error' && (
            <div
              style={{
                background: 'rgba(239,68,68,0.06)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 8,
                padding: '12px 16px',
                fontSize: 13,
                color: '#ef4444',
              }}
            >
              Error: {state.message}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={state.status === 'loading'}
            style={{
              padding: '11px 20px',
              borderRadius: 8,
              border: '1px solid var(--accent)',
              background: state.status === 'loading' ? 'var(--surface-2)' : 'rgba(239,68,68,0.1)',
              color: state.status === 'loading' ? 'var(--muted)' : 'var(--accent)',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              cursor: state.status === 'loading' ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-roboto-slab), "Roboto Slab", Georgia, serif',
              transition: 'background 0.15s',
            }}
          >
            {state.status === 'loading' ? 'Submitting…' : 'Log Note'}
          </button>
        </form>
      </div>
    </div>
  )
}
