# Alethi - AI-First Communication Platform

Alethi is an AI-first communication platform inspired by the concept of "Dæmons" from Philip Pullman's *His Dark Materials*. Every user has a personal, persistent AI agent (their Alethi Dæmon) that acts as their digital companion, context-gatherer, and representative.

## Features

### Personal Hub
- 1-on-1 dashboard for interacting with your Dæmon
- Daily briefings and status updates
- Natural language queries about your work
- Streaming AI responses with conversation history

### Spectator Mode
- Watch Dæmon-to-Dæmon negotiations in real-time
- Split-pane UI showing both parties
- Intent indicators (requesting, proposing, accepted, etc.)
- Ability to intervene in active negotiations

### Context Engine (MCP Integration)
- GitHub integration for repository, PR, and issue context
- Work Graph builder for synthesizing activity
- Privacy-first context sharing

### Privacy Layer ("Anti-Ick Wall")
- Configurable privacy levels (minimal, balanced, open)
- Sensitive content filtering (salary, medical, HR, etc.)
- Audit logging for transparency
- Raw data never shared—only synthesized "Truths"

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **AI SDK**: Vercel AI SDK (OpenAI + Anthropic)
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: NextAuth.js v5
- **MCP**: Model Context Protocol SDK

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- OpenAI and/or Anthropic API keys

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/alethi.git
cd alethi
```

2. Install dependencies:
```bash
npm install
```

3. Copy the environment file and configure:
```bash
cp .env.example .env.local
```

4. Update `.env.local` with your credentials:
```env
DATABASE_URL=postgres://user:password@localhost:5432/alethi
AUTH_SECRET=your-generated-secret
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

5. Generate and run database migrations:
```bash
npm run db:generate
npm run db:push
```

6. Start the development server:
```bash
npm run dev
```

7. Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
alethi/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── (auth)/            # Auth pages (login, register)
│   │   ├── (dashboard)/       # Protected dashboard pages
│   │   │   ├── hub/           # Personal Hub
│   │   │   ├── spectator/     # Spectator UI
│   │   │   └── settings/      # User settings
│   │   └── api/               # API routes
│   ├── components/            # React components
│   │   ├── daemon/            # Dæmon-related components
│   │   ├── spectator/         # Spectator UI components
│   │   └── ui/                # shadcn/ui components
│   ├── lib/
│   │   ├── ai/                # AI providers and Dæmon logic
│   │   ├── db/                # Database schema and client
│   │   ├── mcp/               # MCP integration
│   │   └── privacy/           # Privacy filter
│   └── types/                 # TypeScript types
├── drizzle/                   # Database migrations
└── public/                    # Static assets
```

## Key Concepts

### TruthPacket
The privacy-safe data structure shared between Dæmons:
```typescript
interface TruthPacket {
  availability: string[];      // "Free Tuesday 2-4pm"
  workloadSummary: string;     // "Currently on 2 high-priority tasks"
  relevantExpertise: string[]; // "Has context on auth system"
  currentFocus?: string;
  lastActiveProject?: string;
}
```

### Privacy Levels
- **Minimal**: Share only availability and project names
- **Balanced**: Share project context and workload (recommended)
- **Open**: Share freely for better collaboration

### Negotiation Intents
- `request`: Asking for something
- `propose`: Making a specific offer
- `accept`: Agreeing to a proposal
- `counter`: Proposing a modified alternative
- `decline`: Politely declining

## Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run db:generate  # Generate database migrations
npm run db:push      # Push schema to database
npm run db:studio    # Open Drizzle Studio
```

## License

MIT
