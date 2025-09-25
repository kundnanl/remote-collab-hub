# Remote Collab Hub

A collaborative workspace platform built with **Next.js**, **tRPC**, **Prisma**, and **Clerk** to streamline remote teamwork. It provides task management, virtual office features, and secure organization-level permissions for distributed teams.

## 🚀 Features

* **Authentication & Org Management**: Powered by Clerk for user and organization handling
* **Role-Based Access**: Ensure only org members can access their tasks and projects
* **Task Management**: Create, assign, prioritize, and track tasks with support for `TaskType` and `TaskPriority`
* **Virtual Office**: A shared digital workspace for async + real-time collaboration
* **tRPC API Layer**: Type-safe server calls with strict auth enforcement
* **Database**: Backed by Prisma + PostgreSQL

## 🛠️ Tech Stack

* **Frontend**: Next.js 13+ (App Router) + React
* **Backend**: tRPC
* **Database**: Prisma ORM + PostgreSQL
* **Auth**: Clerk
* **UI**: Radix UI + TailwindCSS
* **Deployment**: Vercel / Docker

## 📦 Installation

### Prerequisites

* Node.js `>=18`
* PostgreSQL database
* Clerk API keys

### Setup

```bash
# Clone the repo
git clone https://github.com/your-org/remote-collab-hub.git
cd remote-collab-hub

# Install dependencies
pnpm install

# Setup environment
cp .env.example .env.local
# Fill in required vars (see below)

# Run migrations
pnpm prisma migrate dev

# Start dev server
pnpm dev
```

## ⚙️ Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXT_PUBLIC_CLERK_KEY` | Clerk publishable key |
| `CLERK_SECRET_KEY` | Clerk backend key |

## 📖 Scripts

* `pnpm dev` – Start dev server
* `pnpm build` – Build for production
* `pnpm start` – Run production build
* `pnpm prisma studio` – Explore DB visually

## 🧑‍💻 Contributing

We welcome contributions!

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/foo`)
3. Commit changes (`git commit -m "Add foo feature"`)
4. Push and open a PR 🎉

## 🗺 Roadmap

* ✅ Task CRUD with org enforcement
* ✅ Role-based membership checks
* 🔄 Virtual office space (real-time presence, chat)
* 🔄 Integrations with Slack/Google Calendar
* 🔄 Analytics dashboard

## 📜 License

MIT © 2025 Remote Collab Hub Team