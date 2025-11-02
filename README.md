# Elora AI Receptionist for Salons

A sophisticated voice-based virtual receptionist system built with the LiveKit Agents Framework that enables salon clients to interact naturally with an AI assistant. Elora retrieves accurate responses from a knowledge base and escalates unknown queries to human supervisors.

## Key Features

- **RAG-Based Retrieval System**: Custom retrieval using TF-IDF, string similarity, and keyword matching for precise answer lookups from the knowledge base
- **Natural Language Processing**: Detects conversation endings using sentiment analysis and NLP techniques (farewell detection, gratitude expressions, closure phrases)
- **Voice Interface**: Real-time voice interaction powered by LiveKit with Assembly AI STT, OpenAI GPT-4o-mini LLM, and Cartesia TTS
- **Smart Escalation System**: Unknown questions are automatically flagged and sent to supervisors with categorization (Pending < 24h, Unresolved > 24h, Resolved)
- **Knowledge Base Integration**: Resolved queries automatically populate the knowledge base for future reference
- **Admin Dashboard**: Review and respond to customer queries, browse knowledge base, with dark/light theme support
- **Multi-Factor Scoring**: Combines TF-IDF cosine similarity (40%), string similarity (35%), and keyword matching (25%) for accurate retrieval

## Project Structure

```
elora-ai-receptionist/
├── backend/
│   ├── src/
│   │   ├── agent/
│   │   │   ├── worker.js          # LiveKit agent implementation
│   │   │   ├── retriever.js       # RAG retrieval system
│   │   │   └── endings.js         # Conversation ending detection
│   │   ├── api/
│   │   │   ├── index.js           # API router
│   │   │   ├── requests.js        # Request management endpoints
│   │   │   ├── knowledge.js       # Knowledge base endpoints
│   │   │   └── livekit.js         # LiveKit token generation
│   │   ├── config.js              # Configuration management
│   │   ├── database.js            # Firebase Firestore operations
│   │   └── index.js               # Express server entry point
│   ├── .env                       # Environment variables
│   ├── .gitignore
│   ├── package.json
│   └── package-lock.json
│
├── ui-admin/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout.jsx         # Main layout with navigation
│   │   │   ├── RequestItem.jsx    # Individual request component
│   │   │   ├── RequestList.jsx    # Request list container
│   │   │   └── ThemeTogle.jsx     # Theme switcher
│   │   ├── context/
│   │   │   └── ThemeContext.jsx   # Theme management context
│   │   ├── services/
│   │   │   └── apiClient.js       # Backend API client
│   │   ├── views/
│   │   │   ├── Dashboard.jsx      # Main dashboard view
│   │   │   └── Knowledge.jsx      # Knowledge base view
│   │   ├── App.jsx                # App router
│   │   ├── App.css                # App styles
│   │   ├── index.css              # Global styles
│   │   └── main.jsx               # React entry point
│   ├── index.html
│   ├── .gitignore
│   ├── eslint.config.js
│   ├── package.json
│   ├── package-lock.json
│   └── vite.config.js
│
└── ui-client/
    ├── src/
    │   ├── components/
    │   │   └── CallInterface.jsx  # LiveKit call interface
    │   ├── services/
    │   │   └── livekitClient.js   # LiveKit connection service
    │   ├── App.jsx
    │   ├── App.css
    │   ├── CallInterface.css      # Call interface styles
    │   ├── index.css
    │   └── main.jsx
    ├── .env                       # Environment variables
    ├── index.html
    ├── .gitignore
    ├── eslint.config.js
    ├── package.json
    ├── package-lock.json
    └── vite.config.js
```

## Tech Stack

### Backend
- **Runtime**: Node.js (ES Modules)
- **Framework**: Express.js
- **Database**: Firebase Firestore
- **Voice Agent**: LiveKit Agents Framework
  - STT: Assembly AI Universal Streaming
  - LLM: OpenAI GPT-4o-mini
  - TTS: Cartesia Sonic 3
  - VAD: Silero
- **NLP Libraries**: Natural, Compromise, String Similarity

### Frontend (Admin)
- **Framework**: React 19 with Vite
- **Routing**: React Router DOM
- **HTTP Client**: Axios
- **Styling**: Custom CSS with theme support

### Frontend (Client)
- **Framework**: React 19 with Vite
- **Real-time Communication**: LiveKit Client SDK
- **UI Components**: @livekit/components-react
- **HTTP Client**: Axios

## Prerequisites

- Node.js 18+ and npm
- Firebase project with Firestore enabled
- LiveKit Cloud account or self-hosted instance

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/elora-ai-receptionist.git
cd elora-ai-receptionist
```

### 2. Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file:

```env
PORT=8080

# Firebase Configuration
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account-email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour-Private-Key\n-----END PRIVATE KEY-----\n"

# LiveKit Configuration
LIVEKIT_URL=wss://your-livekit-instance.livekit.cloud
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret
```

### 3. Admin Panel Setup

```bash
cd ui-admin
npm install
```

### 4. Client Interface Setup

```bash
cd ui-client
npm install
```

Create a `.env` file:

```env
VITE_LIVEKIT_URL=wss://your-livekit-instance.livekit.cloud
```

## Running the Application

### Start the Backend Server

```bash
cd backend
npm run dev
```

Server runs on `http://localhost:8080`

### Start the LiveKit Agent Worker

In a separate terminal:

```bash
cd backend
npm run agent
```

### Start the Admin Panel

```bash
cd ui-admin
npm run dev
```

Admin panel runs on `http://localhost:5173`

### Start the Client Interface

```bash
cd ui-client
npm run dev
```

Client interface runs on `http://localhost:5174`

## API Documentation

### Request Endpoints

- `GET /api/requests/pending` - Fetch pending requests (< 24h)
- `GET /api/requests/unresolved` - Fetch unresolved requests (> 24h)
- `GET /api/requests/resolved` - Fetch resolved requests
- `POST /api/requests/:id/resolve` - Resolve a request with an answer

### Knowledge Base Endpoints

- `GET /api/knowledge` - Fetch entire knowledge base

### LiveKit Endpoints

- `POST /api/livekit/token` - Generate LiveKit access token

## Request Lifecycle

1. **Client asks question** → Voice agent checks knowledge base
2. **If not found** → Creates pending request
3. **After 24 hours** → Moves to unresolved
4. **Supervisor resolves** → Added to knowledge base + simulated SMS
5. **Future queries** → Retrieved from knowledge base

## Environment Variables

### Backend Required Variables
- `FIREBASE_PROJECT_ID` - Firebase project ID
- `FIREBASE_CLIENT_EMAIL` - Service account email
- `FIREBASE_PRIVATE_KEY` - Service account private key
- `LIVEKIT_URL` - LiveKit server WebSocket URL
- `LIVEKIT_API_KEY` - LiveKit API key
- `LIVEKIT_API_SECRET` - LiveKit API secret

### Client Required Variables
- `VITE_LIVEKIT_URL` - LiveKit server WebSocket URL

## License

This project is licensed under the ISC License.

## Support

For issues and questions, please open an issue on GitHub or contact the maintainers.

---
