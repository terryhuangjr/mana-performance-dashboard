# MANA Performance Dashboard

**Physical-therapy practice management** — pipeline, client roster, and scheduling intelligence for a single-location performance therapy practice. AI-agent-integrated: an always-on assistant manages the pipeline, syncs the calendar, drafts outreach, and guards patient privacy.

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)

## Overview

A production practice-management system for a physical therapy business: a drag-and-drop **pipeline Kanban** (New → Contacted → Follow-up → Converted / Declined / Expired), a searchable **active-client roster**, a Jane App–synced **calendar**, and a task board — all surfaced to the owner through a clean dashboard and to an AI agent through a Supabase-backed data layer.

## Problem → Solution

**Problem:** A busy therapy practice ran its sales pipeline and client tracking in spreadsheets and memory — no visibility into who needed follow-up, no history, no automation, and patient data stored in plaintext.

**Solution:** A purpose-built dashboard + agent stack where every patient is an opaque `MANA###` code (zero plaintext PHI at rest), the Jane App iCal feed is the single source of truth for appointments, and the pipeline is governed by a rules engine the AI agent follows (7-day follow-up anchor, 60-day expiry detection, two-level outreach model).

## Key Features

- **6-stage pipeline board** — drag-and-drop Kanban: New / Contacted / Follow-up / Converted / Declined / **Expired** (60d+ never-converted, view-derived, revivable)
- **Month-agnostic persistence** — open cards survive month rollover; resolved cards archive to the conversion month
- **Real program tracking** — actual programs (MANA 6/10/20, BK, NAHL, Cobblestone) from pipeline + archive conversions
- **Client roster** — search/filter/sort across the practice; visit history, next-visit, status derived from appointments
- **Jane App iCal sync** — server-side sync (service-role key) as the only pipeline source
- **AI agent integration** — the "MANA Bot" reads/writes the pipeline, drafts outreach (drafts-only, human-gated), and runs follow-up automations
- **PHI-first security** — all 10 tables RLS-enabled, anon role locked to browser needs, server-side scripts on `service_role`, encrypted name→code vault, zero patient names in the system

## Tech Stack

- **Frontend:** React 18 + TypeScript + Vite (single-page dashboard)
- **Backend/data:** Supabase (Postgres + RLS + auth), Node.js sync scripts
- **AI:** Hermes agent profile with task/calendar/pipeline tooling + rules engine
- **Hosting:** Vercel (dashboard), Supabase (database), local agent runtime

## Architecture

```
Jane App (iCal) ──▶ sync-ical.cjs ──▶ Supabase (mana_appointments)
                                            │
MANA Bot (Hermes agent) ◀──▶ Supabase RLS ──┴──▶ React dashboard (Vercel)
   rules engine · outreach drafts · pipeline ops
```

- **PHI tokenization:** patients are `MANA###` codes; names live only in an encrypted key vault (master key via env, never committed)
- **Key separation:** browser uses anon key (SELECT + pipeline updates); server-side scripts use `service_role` from a local `.env` (gitignored); RLS advisor lints clean

## Screenshots

Dashboard is live at **https://mana-dashboard-pink.vercel.app** (demo credentials on request).

## Status

✅ **Production deployed** — in daily use by a real practice (2026). Continuously maintained: pipeline v2, PHI tokenization, RLS hardening, and the Expired-stage model shipped Aug 2026.
