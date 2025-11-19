- **Node.js + TypeScript** backend (inside `/server`)
- **Vite** frontend (inside `/src`)
- **REST API** integration
- Optional **PostgreSQL** support (via pg / Prisma / Knex)
- Supports integration with Direct Line API (Microsoft Copilot Studio)

- # 🛠 Requirements
Install these before setup:

- Node.js 18+  
- npm or yarn  
- (Optional) PostgreSQL 13+  
- (Optional) Prisma / pg library 

Clone the repo
https://github.com/MinThantHtet1111/rotary_chat.git

# Start Frontend (Vite)
```
npm install
npm run dev
```

# Environment Setup (.env)
.env.example
```
PORT=your port
NODE_ENV=development
DATABASE_URL=your database URL

JWT_SECRET=your JWT Secret

DIRECT_LINE_SECRET=your Direct Line Secret

FRONTEND_ORIGIN=http://localhost:5173
FRONTEND_VERIFY_REDIRECT=http://localhost:5173/#/verified

SMTP_HOST=your SMTP HOST
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=your passkey
MAIL_FROM=
```

# Database Setup (Optional)
Using PostgreSQL
```
DATABASE_URL=postgresql://postgres:password@localhost:5432/mydatabase
```
- postgres → username
- password → DB password
- localhost → running on your machine
- 5432 → default PostgreSQL port
- mydatabase → your DB name

Or Using Prisma
```
npx prisma migrate dev
npx prisma generate
```

# Install backend dependencies
```
cd server
npm install
```

# Start Backend (Node.js + TypeScript)
```
cd server
npm run dev
```
