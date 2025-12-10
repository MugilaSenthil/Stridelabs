# Deployment Instructions

## Overview

This project uses a split deployment strategy:
- **Frontend**: Vercel (FREE)
- **Backend**: Render (FREE)

---

## Local Development

### Frontend (React + Vite)

```bash
# Install dependencies
npm install

# Create .env file
echo "VITE_API_BASE_URL=http://localhost:8000" > .env

# Start development server
npm run dev
```

Frontend runs at: `http://localhost:5173`

### Backend (FastAPI)

```bash
# Navigate to templates folder
cd public/templates

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set environment variables
export OPENAI_API_KEY=your_key_here
export TAVILY_API_KEY=your_key_here

# Run the server
uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```

Backend runs at: `http://localhost:8000`

API Docs: `http://localhost:8000/docs`

---

## Production Deployment

### Step 1: Deploy Backend to Render

1. **Create Render Account**: Go to [render.com](https://render.com) and sign up (free)

2. **Connect Repository**: Link your GitHub repository

3. **Create Web Service**:
   - Click "New" → "Web Service"
   - Select your repository
   - Configure:
     - **Name**: `emissions-api`
     - **Region**: Oregon (or nearest)
     - **Branch**: `main`
     - **Runtime**: Python 3
     - **Build Command**: `pip install -r public/templates/requirements.txt`
     - **Start Command**: `uvicorn public.templates.api.main:app --host 0.0.0.0 --port $PORT`
     - **Plan**: Free

4. **Set Environment Variables** (in Render dashboard):
   ```
   OPENAI_API_KEY=sk-your-key
   TAVILY_API_KEY=tvly-your-key
   CORS_ORIGINS=https://your-app.vercel.app
   ```

5. **Deploy**: Click "Create Web Service"

6. **Note your API URL**: `https://emissions-api.onrender.com`

### Step 2: Deploy Frontend to Vercel

1. **Create Vercel Account**: Go to [vercel.com](https://vercel.com) and sign up (free)

2. **Import Project**:
   - Click "Add New" → "Project"
   - Import your GitHub repository

3. **Configure Build Settings**:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

4. **Set Environment Variables**:
   ```
   VITE_API_BASE_URL=https://emissions-api.onrender.com
   ```

5. **Deploy**: Click "Deploy"

6. **Note your frontend URL**: `https://your-app.vercel.app`

### Step 3: Update CORS

After both are deployed, update the backend's CORS settings:

1. Go to Render dashboard → Your service → Environment
2. Update `CORS_ORIGINS`:
   ```
   CORS_ORIGINS=https://your-app.vercel.app
   ```
3. Redeploy the backend

---

## Alternative: Railway Deployment

### Backend on Railway

1. Go to [railway.app](https://railway.app) and sign up

2. Create new project → Deploy from GitHub

3. Set environment variables:
   ```
   OPENAI_API_KEY=sk-your-key
   TAVILY_API_KEY=tvly-your-key
   CORS_ORIGINS=https://your-app.vercel.app
   PORT=8000
   ```

4. Add start command in Settings:
   ```
   uvicorn public.templates.api.main:app --host 0.0.0.0 --port $PORT
   ```

---

## Environment Variables Reference

### Frontend (.env)
```env
VITE_API_BASE_URL=https://your-backend-url.com
```

### Backend
| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | OpenAI API key for chat | Optional |
| `TAVILY_API_KEY` | Tavily API key for search | Optional |
| `CORS_ORIGINS` | Allowed frontend origins | Yes |
| `PORT` | Server port (auto-set by Render) | Auto |

---

## Troubleshooting

### CORS Errors
- Ensure `CORS_ORIGINS` includes your frontend URL
- Don't include trailing slashes
- For multiple origins: `https://app1.com,https://app2.com`

### API Not Responding
- Check Render logs for errors
- Verify the health endpoint: `https://your-api.onrender.com/health`
- Free tier services sleep after 15 mins of inactivity (first request may be slow)

### Build Failures
- Check that all dependencies are in `requirements.txt`
- Verify Python version compatibility

---

## File Structure

```
project/
├── public/
│   ├── templates/
│   │   ├── api/
│   │   │   └── main.py          # FastAPI backend
│   │   ├── pipeline/
│   │   │   └── merge_data.py    # ETL script
│   │   ├── requirements.txt     # Python dependencies
│   │   ├── Dockerfile          # Docker config
│   │   └── Procfile            # Heroku/Railway config
│   └── data/                    # CSV data files
├── src/                         # React frontend
├── vercel.json                  # Vercel config
├── render.yaml                  # Render blueprint
└── DEPLOYMENT.md               # This file
```
