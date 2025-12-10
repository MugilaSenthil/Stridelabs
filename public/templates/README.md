# 🌍 Global Emissions Intelligence Dashboard

A comprehensive dashboard for analyzing global greenhouse gas emissions data with AI-powered insights.

![Dashboard Preview](./screenshots/dashboard.png)

## ✨ Features

- **📊 Interactive Visualizations**: Emission trends, sector breakdowns, country comparisons
- **🗺️ World Map**: Choropleth visualization of global emissions
- **🔍 Advanced Filters**: Filter by country, continent, gas type, and year
- **🤖 AI Assistant**: Chat with your data using GPT-4 and web search
- **📥 Data Export**: Download filtered data as CSV
- **⚡ Real-time Updates**: Dynamic charts that respond to filter changes

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    React Frontend                        │
│  ┌─────────┐ ┌──────────┐ ┌────────┐ ┌───────────────┐ │
│  │ Charts  │ │ Filters  │ │  Map   │ │  AI Chat      │ │
│  │(Recharts)│ │(Shadcn) │ │ (SVG)  │ │  (GPT-4)      │ │
│  └─────────┘ └──────────┘ └────────┘ └───────────────┘ │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                  FastAPI Backend                         │
│  ┌─────────────┐ ┌─────────────┐ ┌──────────────────┐  │
│  │ /data       │ │ /query      │ │ /insights        │  │
│  │ Emissions   │ │ AI Chat     │ │ Auto-generated   │  │
│  │ Endpoint    │ │ Endpoint    │ │ Analytics        │  │
│  └─────────────┘ └─────────────┘ └──────────────────┘  │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                    Data Layer                            │
│  ┌─────────────────────────────────────────────────┐   │
│  │          final_emissions_dataset.csv             │   │
│  │   (OWID + EDGAR + Climate Watch merged data)     │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## 📁 Project Structure

```
/
├── data/                        # Emissions datasets
│   ├── final_emissions_dataset.csv
│   ├── ghg-emissions-by-sector.csv
│   └── owid-co2-data.csv
├── pipeline/
│   └── merge_data.py           # ETL script
├── api/
│   └── main.py                 # FastAPI backend
├── src/                        # React frontend (Lovable)
│   ├── components/
│   │   └── dashboard/
│   │       ├── StatCard.tsx
│   │       ├── EmissionsTrendChart.tsx
│   │       ├── SectorBreakdown.tsx
│   │       ├── TopEmittersChart.tsx
│   │       ├── WorldMap.tsx
│   │       ├── FilterPanel.tsx
│   │       └── AIChatPanel.tsx
│   ├── hooks/
│   │   └── useEmissionsData.ts
│   └── pages/
│       └── Index.tsx
├── Dockerfile
├── requirements.txt
└── README.md
```

## 🚀 Quick Start

### Frontend (React - Lovable)

The frontend runs automatically in Lovable. No setup required!

### Backend (Python - Local)

1. **Clone and navigate to templates:**
   ```bash
   cd public/templates
   ```

2. **Create virtual environment:**
   ```bash
   python -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Run ETL pipeline:**
   ```bash
   python pipeline/merge_data.py
   ```

5. **Set environment variables:**
   ```bash
   export OPENAI_API_KEY="your-openai-key"
   export TAVILY_API_KEY="your-tavily-key"  # Optional
   ```

6. **Start the API:**
   ```bash
   uvicorn api.main:app --reload --port 8000
   ```

## 🐳 Docker Deployment

### Build and run:

```bash
# Build the image
docker build -t emissions-dashboard .

# Run the container
docker run -p 80:80 -p 8000:8000 \
  -e OPENAI_API_KEY="your-key" \
  emissions-dashboard
```

### Docker Compose (recommended):

```yaml
version: '3.8'
services:
  dashboard:
    build: .
    ports:
      - "80:80"
      - "8000:8000"
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - TAVILY_API_KEY=${TAVILY_API_KEY}
    volumes:
      - ./data:/app/data
```

## ☁️ Cloud Deployment

### Railway

1. Connect your GitHub repository
2. Set environment variables in Railway dashboard
3. Deploy automatically on push

### Render

1. Create a new Web Service
2. Connect repository
3. Set build command: `pip install -r requirements.txt`
4. Set start command: `uvicorn api.main:app --host 0.0.0.0 --port $PORT`

### AWS (ECS/Fargate)

1. Push Docker image to ECR
2. Create ECS task definition
3. Deploy to Fargate cluster

## 🔧 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes (for AI) | OpenAI API key for GPT-4 |
| `TAVILY_API_KEY` | No | Tavily API key for web search |
| `PORT` | No | Server port (default: 8000) |

## 📊 Data Sources

- **OWID**: Our World in Data CO2 dataset
- **EDGAR**: EC Joint Research Centre emissions database
- **Climate Watch**: World Resources Institute historical data

## 🤖 AI Features

The AI assistant can:
- Answer questions about emissions data
- Explain trends and patterns
- Search the web for recent climate news
- Generate insights and summaries
- Perform calculations on demand

## 📸 Screenshots

### Dashboard Overview
![Dashboard](./screenshots/dashboard.png)

### World Map
![World Map](./screenshots/worldmap.png)

### AI Chat
![AI Chat](./screenshots/chat.png)

## 📝 API Documentation

Once the backend is running, visit:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

### Key Endpoints

```
GET  /data          - Retrieve emissions data with filters
POST /query         - AI-powered data query
GET  /insights      - Auto-generated insights
GET  /countries     - List all countries
GET  /years         - List available years
GET  /health        - Health check
```

## 🛠️ Development

```bash
# Run frontend (Lovable)
# Automatic in Lovable environment

# Run backend with hot reload
uvicorn api.main:app --reload

# Run ETL pipeline
python pipeline/merge_data.py

# Run tests
pytest tests/
```

## 📄 License

MIT License - feel free to use this project for any purpose.

## 🙏 Acknowledgments

- Data: Our World in Data, EDGAR, Climate Watch
- Built with: React, FastAPI, LangChain, Recharts
- Hosted on: Lovable
