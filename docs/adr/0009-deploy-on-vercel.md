# Deploy the platform on Vercel

The orchestrator (auth, conversation state, engine loop, sandbox wiring) runs on
Vercel, matching the frontend and sandboxes. Conversations are short-lived so a
serverless-friendly loop fits. A dedicated long-lived compute service is a later
step only if the loop outgrows serverless constraints.