# Kairos — Live Threat Intelligence Dashboard

> Next.js 15 frontend for the Kairos AI school safety platform. Real-time threat feed, GPS heatmap, Bayesian breakdown modal, and agent payment ledger.

**Live** → [threat-vector.vercel.app](https://threat-vector.vercel.app)  
**Backend + Full Docs** → [threat-vector README](https://github.com/devteamaegis/threat-vector/blob/main/README.md) — complete system architecture, Bayesian math, and sponsor integration details

---

## Stack

- **Next.js 15** App Router · TypeScript · Tailwind v4
- **Supabase Realtime** — websocket subscription for instant tip card updates
- **Mapbox GL** — live GPS heatmap with caller pins + geocoded spoken-address pins
- **Vercel** — production deployment, auto-deploys on every push to `main`

## Key Components

| Component | Purpose |
|-----------|---------|
| `app/page.tsx` | Main dashboard — animated orb state machine, live call overlay, tip feed, pipeline visualizer |
| `components/ThreatHeatmap.tsx` | Mapbox heatmap + caller GPS pins + red pulsing spoken-address pins + user location dot |
| `components/ThreatBreakdownModal.tsx` | Full Bayesian breakdown, 3-model consensus display, CI interpretation, "What This Means" |
| `components/SpongeWalletPanel.tsx` | Sponge agent micropayment ledger + real background check PDF export |
| `app/heatmap/page.tsx` | Full-screen live heatmap with always-on 6s polling |
| `app/api/sponge/demo/route.ts` | Proxies demo background check to Railway backend |

## Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_MAPBOX_TOKEN=
SUPABASE_SERVICE_ROLE_KEY=
BACKEND_URL=https://threat-vector-production.up.railway.app
```

## Running Locally

```bash
npm install
cp .env.example .env.local   # fill in tokens above
npm run dev                  # http://localhost:3000
```

The dashboard works standalone — it reads from Supabase directly. Set `BACKEND_URL` to point at the Railway backend (or `http://localhost:8001` if running locally) to enable live call processing and background checks.
