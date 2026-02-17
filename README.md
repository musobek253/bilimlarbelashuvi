# Aqlli Arqon - Battle Quiz

Aqlli Arqon (Smart Rope) is a full-stack, real-time multiplayer quiz game designed as a Telegram Web App. Players compete in knowledge battles where correct answers pull the "rope" towards them, aiming to win the match.

## 🚀 Features

- **Real-time Multiplayer**: Dynamic matchmaking and live game updates using Socket.io.
- **Telegram Integration**: Seamless login and user profiles via Telegram Web Apps API.
- **Microservices Architecture**: Modular services for scalability and maintainability.
- **Admin Panel**: Comprehensive management tools for users and game data.
- **Cross-Platform**: Optimized for mobile (Telegram) and desktop browsers.

## 📁 Monorepo Structure

The project is organized as a monorepo using NPM workspaces:

- `apps/gateway`: The entry point for all client requests. Handles HTTP proxying and WebSocket orchestration.
- `apps/auth`: Manages user authentication, profiles, ratings, and leaderboard logic via Prisma (PostgreSQL).
- `apps/game`: The core game engine. Handles matchmaking, game state management, and scoring logic.
- `apps/frontend`: Modern React application (Vite) with a premium UI/UX design.
- `apps/bot`: Telegram bot for entry, notifications, and administrative updates.
- `packages/shared`: Shared types and constants used across multiple services.

## 🛠 Tech Stack

- **Backend**: Node.js, Express.js, Socket.io
- **Database**: PostgreSQL (Prisma ORM)
- **Frontend**: React, TypeScript, Vite, TailwindCSS, Framer Motion
- **DevOps**: Docker, Docker Compose, Caddy (Reverse Proxy)

## 🛠 Local Development

### Prerequisites

- Node.js (v18+)
- Docker & Docker Compose (optional but recommended)

### Setup

1. Clone the repository.
2. Install dependencies at the root:
   ```bash
   npm install
   ```
3. Set up environment variables in the root `.env` file (see `.env.example` if available).

### Running Services

You can run services individually or all at once:

```bash
# Run all services concurrently (Dev Mode)
npm run dev:all

# Run individual services
npm run dev:gateway
npm run dev:auth
npm run dev:game
npm run dev:frontend
npm run dev:bot
```

## 🚢 Deployment

The project includes deployment scripts for automated staging and production updates:
- `deploy.sh`: Manual deployment script.
- `auto_deploy.sh`: CI/CD friendly deployment with automated builds and container restarts.

## 📄 License

Private Project - All rights reserved.
