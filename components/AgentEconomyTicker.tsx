'use client'

import { useEffect, useState } from 'react'

interface Transaction {
  service: string
  amount: number
  label: string
  icon: string
  call_id?: string
}

interface WalletData {
  balance: number | null
  transactions: Transaction[]
}

export default function AgentEconomyTicker() {
  const [data, setData] = useState<WalletData>({ balance: null, transactions: [] })
  const [visible, setVisible] = useState(0) // index of most recent tx to show

  useEffect(() => {
    const load = () =>
      fetch('/api/sponge')
        .then(r => r.json())
        .then(setData)
        .catch(() => {})
    load()
    const id = setInterval(load, 30_000)
    return () => clearInterval(id)
  }, [])

  // Cycle through transactions every 2.5s
  useEffect(() => {
    if (!data.transactions.length) return
    const id = setInterval(
      () => setVisible(v => (v + 1) % data.transactions.length),
      2500,
    )
    return () => clearInterval(id)
  }, [data.transactions.length])

  const tx = data.transactions[visible]
  const totalSpent = data.transactions.reduce((s, t) => s + (t.amount ?? 0), 0)

  return (
    <div
      className="flex items-center gap-3 px-3 py-2 rounded-lg border text-xs"
      style={{ background: 'rgba(16,185,129,0.07)', borderColor: 'rgba(134,239,172,0.35)' }}
      title="Autonomous agent micropayments powered by Sponge"
    >
      {/* Sponge logo / label */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-base">🪙</span>
        <span className="font-semibold text-emerald-700 tracking-wide">SPONGE</span>
      </div>

      {/* Divider */}
      <div className="w-px h-4 bg-emerald-200 shrink-0" />

      {/* Live transaction ticker */}
      {tx ? (
        <div className="flex items-center gap-1.5 overflow-hidden">
          <span className="text-sm">{tx.icon}</span>
          <span className="text-emerald-800 font-medium whitespace-nowrap">{tx.label}</span>
          <span className="text-emerald-600 font-mono font-bold">${tx.amount.toFixed(3)}</span>
          <span className="text-emerald-400 text-[10px]">auto-paid</span>
        </div>
      ) : (
        <span className="text-emerald-500">no transactions yet</span>
      )}

      {/* Divider */}
      <div className="w-px h-4 bg-emerald-200 shrink-0" />

      {/* Balance / spend */}
      <div className="flex items-center gap-2 shrink-0 ml-auto">
        {data.balance !== null && (
          <span className="text-emerald-600">
            balance <span className="font-mono font-bold text-emerald-800">${data.balance.toFixed(2)}</span>
          </span>
        )}
        {totalSpent > 0 && (
          <span className="text-emerald-500 text-[10px]">
            spent <span className="font-mono">${totalSpent.toFixed(3)}</span>
          </span>
        )}
      </div>
    </div>
  )
}
