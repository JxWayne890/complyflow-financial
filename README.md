# ComplyFlow Financial

A production-ready content marketing and compliance workflow system for financial services.

## Setup Instructions

### 1. Environment Variables
Create a `.env` file in the root directory:
```bash
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_N8N_WEBHOOK_URL=your_n8n_webhook_url
```

### 2. Supabase Setup
1. Create a new Supabase project.
2. Go to the SQL Editor and run the content of `migrations.sql`.
3. Go to Auth settings and enable Email/Password login.
4. Manually insert an Organization and a Profile (Advisor & Compliance) into the tables to start, or build a registration flow (omitted for brevity).

### 3. n8n Setup
1. Import the `n8n_workflows.json` structure into your n8n instance.
2. Configure the OpenAI credentials and Supabase credentials in n8n.
3. Update the `VITE_N8N_WEBHOOK_URL` in your frontend `.env` to match your n8n production URL.

### 4. Running Locally
```bash
npm install
npm run dev
```

### 5. Deployment
Build the project for production:
```bash
npm run build
```
Deploy the `dist` folder to Vercel, Netlify, or any static host.

## Features
- **Role-Based Access**: Advisors create, Compliance reviews.
- **AI Integration**: Stubbed integration for content generation via n8n.
- **Workflow State Machine**: Draft -> In Review -> Approved -> Posted.
- **Audit Trail**: Every version and decision is logged.
