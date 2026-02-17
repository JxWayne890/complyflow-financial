# ComplyFlow Financial

A production-ready content marketing and compliance workflow system for financial services.

## Setup Instructions

### 1. Environment Variables
Create a `.env` file in the root directory:
```bash
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

AI provider keys should be configured as Supabase Edge Function secrets (not in frontend `.env`):
```bash
supabase secrets set ANTHROPIC_API_KEY=your_anthropic_key
supabase secrets set GEMINI_API_KEY=your_gemini_key
supabase secrets set NVIDIA_API_KEY=your_nvidia_key
supabase secrets set CLAUDE_TEXT_MODEL=claude-opus-4-5
supabase secrets set KIMI_TEXT_MODEL=moonshotai/kimi-k2.5
supabase secrets set GEMINI_IMAGE_MODEL=gemini-2.5-flash-image
```

### 2. Supabase Setup
1. Create a new Supabase project.
2. Go to the SQL Editor and run the content of `migrations.sql`.
3. Go to Auth settings and enable Email/Password login.
4. Run `setup_auto_profile_trigger.sql` so every new signup gets an org/profile automatically.
5. Create at least one advisor and one compliance user (or seed using `setup_database.sql`).
6. Run `fix_workflow_rls.sql` in SQL Editor (required for content request/version insert + compliance status updates).
7. Deploy edge functions:
```bash
supabase functions deploy generate-content
supabase functions deploy generate-topics
```

### 3. n8n Setup (Optional)
1. Import the `n8n_workflows.json` structure into your n8n instance.
2. Configure the required credentials in n8n.

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
