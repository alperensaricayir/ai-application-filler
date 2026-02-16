# Erasmus AI Assistant

Full-stack app to generate Erasmus / application-form answers using a pluggable AI provider (Ollama / Groq).

## Quick start (Windows)

- Run `start.bat`
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5137/swagger`

Stop everything with `stop.bat`.

## Manual start

**Backend**

```powershell
cd backend\ErasmusAi.Api
dotnet run --launch-profile "https"
```

**Frontend**

```powershell
cd frontend\erasmus-ai-web
npm install
npm run dev
```

## Notes

- API keys are not committed. Configure them locally (e.g. via env vars / local config).
- Local HTTPS dev certificate may be untrusted on some machines; use the HTTP url if needed.
