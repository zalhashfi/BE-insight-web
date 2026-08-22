# Project Kanban Board: BE-insight-web

## 📋 Backlog / Todo
- [ ] **Ticket-07**: Final Server Integration & Hostinger Deployment Guide (docs already drafted in HOSTINGER_DEPLOYMENT.md)

---

## ⏳ In Progress
*(Tidak ada — semua gelombang selesai)*

---

## 🔍 In Review / Testing
- [ ] Integration tests against live MySQL (CI/local)
- [ ] Manual API smoke test with Postman/curl

---

## ✅ Done
- [x] **Spec & Architecture Review**: `CONTEXT.md`, `PRD.md`, `SPEC.md`
- [x] **Ticket-01**: Project Setup, TypeScript, Express Dependencies & Schema SQL
- [x] **Ticket-02**: Database Connection Pool & Pure SQL Initialization Runner
- [x] **Ticket-03**: IoT Core Routes (`/api/iot/*` - identity, ingest, ota) — Express + Pure SQL
- [x] **Ticket-04**: Hot Path Sensor Data Query (`GET /api/devices/:uuid/data/:sensorType`) — Express + Pure SQL
- [x] **Ticket-05**: Auth & Security Layer (`/api/auth/*` + JWT Middleware) — Express + bcrypt + jwt
- [x] **Ticket-06**: Device & Firmware Management Dashboard APIs (`/api/devices/*`, `/api/firmware/*`) — Express + Pure SQL
- [x] **Refactor**: Converted all sub-agent Hono output to Express; removed Cloudflare/Hono leftovers
- [x] **Build Verification**: `npm run build` passes; server boots on :3000
- [x] **AGENT.md**: Operational guide created
