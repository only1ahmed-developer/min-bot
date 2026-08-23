# Adevos Min-Bot Platform

A unified platform that manages WhatsApp (Multi-Device, via Baileys) and Telegram bots
under one account, backed by a single MongoDB database, with a website (public pages,
user dashboard, admin panel) that reads and writes the same collections as the bots.

## Monorepo layout

```
adevos-min-platform/
  backend/     Express API + WhatsApp engine + Telegram bot (deploy to Render/Railway/Heroku)
  frontend/    Static PWA website (deploy to Vercel)
```

## Core design decisions

- Single MongoDB database. Website, WhatsApp bot, and Telegram bot all read/write the
  same collections (`users`, `sessions`, `whatsapp_groups`, `telegram_groups`, `settings`).
- WhatsApp auth state (Baileys credentials/keys) is stored in MongoDB, not on local disk.
  This makes the WhatsApp engine stateless: redeploying or moving servers does not break
  active sessions.
- Pairing is a single shared service (`backend/src/whatsapp/pairingService.js`). It is
  called from three entry points that all produce the same result:
    1. The website ("Connect WhatsApp" flow)
    2. The Telegram bot (`/pair <number>`)
    3. The WhatsApp bot itself (`.pair <number>`, used by an already-connected number to
       provision another number)
- Website accounts are never created via a public signup form. An account is only ever
  created by:
    - Telegram bot: `/createlogins <username>`
    - WhatsApp bot (private chat / "Message Yourself" only): `.createlogins <username>`
  Both write to the same `users` collection, keyed by a single master `_id`, with
  `telegramId` and `phoneNumber` as optional linkable fields (Dynamic Account Linking).
- Admin panel lives at `/admin` on the same site, protected by a separate admin login
  (credentials from `.env`, JWT-protected routes, bcrypt-hashed password).

## Build phases

This is a large system. It is being built in phases rather than delivered as a single
monolithic drop:

- Phase 1 (this delivery): backend foundation
  - MongoDB models
  - MongoDB-backed Baileys auth state adapter (stateless sessions)
  - WhatsApp socket manager + shared pairing service
  - A working command loader for WhatsApp (`.menu`, `.ping`, `.createlogins`, `.antilink`)
  - Telegram bot core: forced-subscription gate, `/start`, `/help`, `/createlogins`,
    `/pair`, `/status`
  - Auth (JWT), account-linking route, settings route, admin route, group routes
  - Frontend PWA shell: landing page, login, dashboard, admin, with the manifest and
    service worker wired up, calling the phase-1 API
- Phase 2 (next): full group management UI + API, bot settings UI, website command
  console, broadcast tooling, richer WhatsApp/Telegram command sets
- Phase 3 (after that): analytics/reporting, rate limiting/queueing for scale, admin
  audit log, security notifications (masked WhatsApp/Telegram alerts on account changes)

Say "continue" (or "Endelea") and specify which phase/section to expand next.
