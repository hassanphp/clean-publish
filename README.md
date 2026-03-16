# Carveo – AI Image Engine for Car Dealers

Professional automotive photo enhancement with AI-powered studio background replacement.

## Stack

- **Backend:** FastAPI, LangGraph, OpenAI GPT Image 1.5 (V11 pipeline)
- **Frontend:** Next.js 16, React 19, Tailwind CSS

## Quick Start

### Backend

```bash
cd ai-backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
cp .env.example .env      # Edit with your OPENAI_API_KEY, etc.
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd ai-frontend
npm install
cp .env.example .env.local  # Set NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
```

### Database

SQLite by default. Run migrations:

```bash
cd ai-backend && alembic upgrade head
```

Seed admin user (optional):

```bash
cd ai-backend && source venv/bin/activate && python -m app.seed
```

## Environment

- `OPENAI_API_KEY` – Required for V11 image processing
- `GCS_BUCKET` – Optional, for GCS uploads
- `DATABASE_URL` – Optional, defaults to SQLite

## License

Proprietary.
