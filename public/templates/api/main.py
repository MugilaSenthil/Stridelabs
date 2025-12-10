#!/usr/bin/env python3
"""
===============================================================================
Global Emissions Intelligence API
===============================================================================
FastAPI backend for emissions data access and AI-powered insights.

Endpoints:
    GET  /                  - API info and health
    GET  /data              - Retrieve emissions data with filters
    POST /query             - AI chatbot query (LangChain + OpenAI)
    GET  /insights          - Auto-generated insights
    GET  /countries         - List all countries
    GET  /years             - List available years
    GET  /sectors           - List emission sectors
    GET  /health            - Health check

Usage:
    uvicorn main:app --reload --host 0.0.0.0 --port 8000

Environment Variables:
    OPENAI_API_KEY      - OpenAI API key for GPT-4/GPT-5
    TAVILY_API_KEY      - Tavily API key for web search
    DATA_DIR            - Path to data directory (default: ../data)

Requirements:
    pip install fastapi uvicorn pandas openai langchain langchain-openai tavily-python

Author: Global Emissions Dashboard Team
Version: 2.0.0
===============================================================================
"""

from fastapi import FastAPI, HTTPException, Query, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Union
from enum import Enum
import pandas as pd
import numpy as np
import os
import io
import json
from pathlib import Path
from datetime import datetime, timedelta
from functools import lru_cache
import logging
import asyncio
from contextlib import asynccontextmanager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)-8s | %(name)s | %(message)s'
)
logger = logging.getLogger(__name__)

# ============================================================================
# OPTIONAL AI IMPORTS
# ============================================================================

LANGCHAIN_AVAILABLE = False
OPENAI_AVAILABLE = False
TAVILY_AVAILABLE = False

try:
    from langchain_openai import ChatOpenAI
    from langchain.schema import HumanMessage, SystemMessage, AIMessage
    from langchain.memory import ConversationBufferWindowMemory
    from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
    from langchain.chains import ConversationChain
    LANGCHAIN_AVAILABLE = True
    logger.info("LangChain loaded successfully")
except ImportError as e:
    logger.warning(f"LangChain not available: {e}")

try:
    import openai
    OPENAI_AVAILABLE = True
    logger.info("OpenAI loaded successfully")
except ImportError:
    logger.warning("OpenAI not available")

try:
    from tavily import TavilyClient
    TAVILY_AVAILABLE = True
    logger.info("Tavily loaded successfully")
except ImportError:
    logger.warning("Tavily not available")

# ============================================================================
# CONFIGURATION
# ============================================================================

# Data paths
DATA_DIR = Path(os.getenv("DATA_DIR", Path(__file__).parent.parent / "data"))
EMISSIONS_FILE = DATA_DIR / "final_emissions_dataset.csv"
SECTOR_FILE = DATA_DIR / "emissions_by_sector.csv"
INSIGHTS_FILE = DATA_DIR / "data_insights.json"

# API configuration
API_TITLE = "Global Emissions Intelligence API"
API_VERSION = "2.0.0"
API_DESCRIPTION = """
## Global Emissions Data API

Access comprehensive greenhouse gas emissions data from multiple sources:
- **OWID** (Our World in Data)
- **EDGAR** (EU Joint Research Centre)
- **Climate Watch**

### Features
- 📊 Filter by country, continent, year, sector, and gas type
- 🤖 AI-powered natural language queries
- 🔍 Web search for latest climate information
- 📈 Auto-generated insights and trends

### Data Coverage
- **Years**: 1990 - Present
- **Countries**: 200+
- **Gases**: CO₂, CH₄, N₂O, Total GHG
- **Sectors**: Energy, Transport, Industry, Agriculture, etc.
"""

# ============================================================================
# ENUMS & MODELS
# ============================================================================

class GasType(str, Enum):
    CO2 = "CO2"
    CH4 = "CH4"
    N2O = "N2O"
    GHG_TOTAL = "GHG Total"
    ALL = "all"


class Continent(str, Enum):
    AFRICA = "Africa"
    ASIA = "Asia"
    EUROPE = "Europe"
    NORTH_AMERICA = "North America"
    SOUTH_AMERICA = "South America"
    OCEANIA = "Oceania"
    ALL = "all"


class Sector(str, Enum):
    ENERGY = "Energy"
    TRANSPORT = "Transport"
    INDUSTRY = "Industry"
    AGRICULTURE = "Agriculture"
    BUILDINGS = "Buildings"
    WASTE = "Waste"
    LAND_USE = "Land Use"
    ALL = "all"


class QueryRequest(BaseModel):
    """Request model for AI chat queries."""
    query: str = Field(..., min_length=1, max_length=1000, description="Natural language question")
    include_web_search: bool = Field(False, description="Include web search for recent information")
    conversation_id: Optional[str] = Field(None, description="Conversation ID for context")
    
    class Config:
        json_schema_extra = {
            "example": {
                "query": "What are the top 5 CO2 emitting countries in 2022?",
                "include_web_search": False
            }
        }


class QueryResponse(BaseModel):
    """Response model for AI chat queries."""
    answer: str
    sources: List[str] = []
    data_context: Optional[Dict[str, Any]] = None
    web_results: Optional[List[Dict[str, str]]] = None
    processing_time_ms: Optional[float] = None


class DataResponse(BaseModel):
    """Response model for data queries."""
    total_records: int
    filters_applied: Dict[str, Any]
    data: List[Dict[str, Any]]


class InsightResponse(BaseModel):
    """Response model for insights endpoint."""
    year: int
    global_emissions_mt: float
    yoy_change_percent: float
    top_emitters: List[Dict[str, Any]]
    continent_breakdown: Dict[str, float]
    sector_breakdown: Optional[Dict[str, float]] = None
    key_findings: List[str]
    generated_at: str


class HealthResponse(BaseModel):
    """Response model for health check."""
    status: str
    version: str
    data_loaded: bool
    records_count: int
    ai_enabled: bool
    web_search_enabled: bool
    last_data_update: Optional[str] = None


# ============================================================================
# DATA MANAGEMENT
# ============================================================================

class DataManager:
    """Manages data loading and caching."""
    
    def __init__(self):
        self._emissions_df: Optional[pd.DataFrame] = None
        self._sector_df: Optional[pd.DataFrame] = None
        self._insights: Optional[Dict] = None
        self._last_load: Optional[datetime] = None
        self._cache_ttl = timedelta(hours=1)
    
    def _should_reload(self) -> bool:
        """Check if cache should be refreshed."""
        if self._last_load is None:
            return True
        return datetime.now() - self._last_load > self._cache_ttl
    
    def load_emissions(self) -> pd.DataFrame:
        """Load emissions data with caching."""
        if self._emissions_df is not None and not self._should_reload():
            return self._emissions_df
        
        if not EMISSIONS_FILE.exists():
            logger.error(f"Emissions file not found: {EMISSIONS_FILE}")
            raise HTTPException(
                status_code=503,
                detail="Data not available. Please run the ETL pipeline first."
            )
        
        logger.info(f"Loading emissions data from {EMISSIONS_FILE}")
        self._emissions_df = pd.read_csv(EMISSIONS_FILE, low_memory=False)
        self._last_load = datetime.now()
        logger.info(f"Loaded {len(self._emissions_df):,} records")
        
        return self._emissions_df
    
    def load_sector_data(self) -> pd.DataFrame:
        """Load sector breakdown data."""
        if self._sector_df is not None and not self._should_reload():
            return self._sector_df
        
        if SECTOR_FILE.exists():
            self._sector_df = pd.read_csv(SECTOR_FILE)
            return self._sector_df
        
        return pd.DataFrame()
    
    def load_insights(self) -> Dict:
        """Load pre-computed insights."""
        if self._insights is not None and not self._should_reload():
            return self._insights
        
        if INSIGHTS_FILE.exists():
            with open(INSIGHTS_FILE) as f:
                self._insights = json.load(f)
                return self._insights
        
        return {}
    
    def get_data_context(self) -> Dict[str, Any]:
        """Get summary context for AI queries."""
        df = self.load_emissions()
        latest_year = int(df['year'].max())
        latest_data = df[df['year'] == latest_year]
        
        context = {
            "latest_year": latest_year,
            "year_range": f"{int(df['year'].min())} - {latest_year}",
            "total_countries": int(df['country'].nunique()),
            "total_records": len(df),
        }
        
        if 'ghg_total_mt' in df.columns:
            context["global_emissions_mt"] = float(latest_data['ghg_total_mt'].sum())
            context["top_emitters"] = latest_data.nlargest(10, 'ghg_total_mt')['country'].tolist()
        
        if 'continent' in df.columns:
            context["continents"] = df['continent'].unique().tolist()
        
        return context
    
    def invalidate_cache(self):
        """Force cache refresh on next access."""
        self._last_load = None


# Global data manager
data_manager = DataManager()


# ============================================================================
# AI SERVICES
# ============================================================================

class AIService:
    """Handles AI-powered queries using LangChain."""
    
    def __init__(self):
        self.chat_model = None
        self.tavily_client = None
        self._conversations: Dict[str, List] = {}
        self._init_services()
    
    def _init_services(self):
        """Initialize AI services if API keys are available."""
        openai_key = os.getenv("OPENAI_API_KEY")
        tavily_key = os.getenv("TAVILY_API_KEY")
        
        if LANGCHAIN_AVAILABLE and openai_key:
            try:
                self.chat_model = ChatOpenAI(
                    model_name="gpt-4-turbo-preview",
                    temperature=0.7,
                    openai_api_key=openai_key,
                    max_tokens=1000
                )
                logger.info("ChatOpenAI initialized successfully")
            except Exception as e:
                logger.error(f"Failed to initialize ChatOpenAI: {e}")
        
        if TAVILY_AVAILABLE and tavily_key:
            try:
                self.tavily_client = TavilyClient(api_key=tavily_key)
                logger.info("Tavily client initialized successfully")
            except Exception as e:
                logger.error(f"Failed to initialize Tavily: {e}")
    
    @property
    def is_ai_enabled(self) -> bool:
        return self.chat_model is not None
    
    @property
    def is_search_enabled(self) -> bool:
        return self.tavily_client is not None
    
    async def search_web(self, query: str, max_results: int = 3) -> List[Dict[str, str]]:
        """Search web using Tavily."""
        if not self.tavily_client:
            return []
        
        try:
            response = self.tavily_client.search(
                query=f"climate emissions {query}",
                max_results=max_results,
                search_depth="advanced"
            )
            
            results = []
            for r in response.get('results', []):
                results.append({
                    'title': r.get('title', ''),
                    'content': r.get('content', '')[:500],
                    'url': r.get('url', '')
                })
            
            return results
            
        except Exception as e:
            logger.error(f"Web search error: {e}")
            return []
    
    async def query(
        self,
        question: str,
        data_context: Dict[str, Any],
        include_web: bool = False,
        conversation_id: Optional[str] = None
    ) -> QueryResponse:
        """Process an AI query with optional web search."""
        import time
        start_time = time.time()
        
        sources = ["Emissions Dataset"]
        web_results = None
        
        # Get web search results if requested
        web_context = ""
        if include_web and self.is_search_enabled:
            web_results = await self.search_web(question)
            if web_results:
                web_context = "\n\nRecent information from web search:\n"
                for r in web_results:
                    web_context += f"- {r['title']}: {r['content']}\n"
                sources.append("Web Search")
        
        # Build AI prompt
        system_prompt = self._build_system_prompt(data_context, web_context)
        
        if self.chat_model:
            try:
                messages = [
                    SystemMessage(content=system_prompt),
                    HumanMessage(content=question)
                ]
                
                response = await asyncio.to_thread(
                    self.chat_model.invoke, messages
                )
                
                answer = response.content
                
            except Exception as e:
                logger.error(f"AI query error: {e}")
                answer = self._generate_fallback_response(question, data_context)
        else:
            answer = self._generate_fallback_response(question, data_context)
        
        processing_time = (time.time() - start_time) * 1000
        
        return QueryResponse(
            answer=answer,
            sources=sources,
            data_context=data_context,
            web_results=web_results,
            processing_time_ms=round(processing_time, 2)
        )
    
    def _build_system_prompt(self, context: Dict, web_context: str = "") -> str:
        """Build system prompt for AI."""
        return f"""You are an expert climate data analyst with access to comprehensive global emissions data.

## Data Context
- Latest year in dataset: {context.get('latest_year')}
- Year range: {context.get('year_range')}
- Total countries: {context.get('total_countries')}
- Global emissions: {context.get('global_emissions_mt', 'N/A'):.2f} Mt CO2e (if available)
- Top emitters: {', '.join(context.get('top_emitters', [])[:5])}

{web_context}

## Guidelines
1. Provide accurate, data-driven responses
2. Use specific numbers and statistics when available
3. Explain trends and patterns clearly
4. If uncertain, acknowledge limitations
5. Suggest relevant follow-up questions
6. Format responses with clear structure using markdown

## Response Format
- Use bullet points for lists
- Include relevant statistics
- Provide context for numbers (comparisons, percentages)
- Be concise but comprehensive"""

    def _generate_fallback_response(self, question: str, context: Dict) -> str:
        """Generate response when AI is not available."""
        return f"""Based on the emissions data available:

**Data Overview ({context.get('latest_year', 'Latest Year')}):**
- Global GHG emissions: {context.get('global_emissions_mt', 'N/A'):.1f} Mt CO2e
- Countries covered: {context.get('total_countries', 'N/A')}
- Year range: {context.get('year_range', 'N/A')}

**Top Emitting Countries:**
{chr(10).join(f'- {c}' for c in context.get('top_emitters', [])[:5])}

*Note: For more detailed AI-powered analysis, please configure the OPENAI_API_KEY environment variable.*

Your question: "{question}"
"""


# Global AI service
ai_service = AIService()


# ============================================================================
# LIFESPAN MANAGEMENT
# ============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    # Startup
    logger.info("Starting Global Emissions API...")
    try:
        data_manager.load_emissions()
        logger.info("Data loaded successfully")
    except Exception as e:
        logger.warning(f"Could not pre-load data: {e}")
    
    yield
    
    # Shutdown
    logger.info("Shutting down Global Emissions API...")


# ============================================================================
# FASTAPI APPLICATION
# ============================================================================

app = FastAPI(
    title=API_TITLE,
    description=API_DESCRIPTION,
    version=API_VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS middleware - reads allowed origins from environment variable
# Set CORS_ORIGINS to comma-separated list of allowed origins
# Example: CORS_ORIGINS=https://your-app.vercel.app,http://localhost:5173
cors_origins_str = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000")
cors_origins = [origin.strip() for origin in cors_origins_str.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins if cors_origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================================
# ENDPOINTS
# ============================================================================

@app.get("/", tags=["Info"])
async def root():
    """API root - returns basic info and available endpoints."""
    return {
        "name": API_TITLE,
        "version": API_VERSION,
        "documentation": "/docs",
        "endpoints": {
            "GET /data": "Retrieve emissions data with filters",
            "POST /query": "AI-powered natural language query",
            "GET /insights": "Auto-generated insights",
            "GET /countries": "List all countries",
            "GET /years": "List available years",
            "GET /sectors": "List emission sectors",
            "GET /health": "Health check",
            "GET /download": "Download data as CSV",
        }
    }


@app.get("/health", response_model=HealthResponse, tags=["Info"])
async def health_check():
    """Health check endpoint."""
    try:
        df = data_manager.load_emissions()
        data_loaded = True
        records_count = len(df)
    except Exception:
        data_loaded = False
        records_count = 0
    
    return HealthResponse(
        status="healthy" if data_loaded else "degraded",
        version=API_VERSION,
        data_loaded=data_loaded,
        records_count=records_count,
        ai_enabled=ai_service.is_ai_enabled,
        web_search_enabled=ai_service.is_search_enabled,
        last_data_update=data_manager._last_load.isoformat() if data_manager._last_load else None
    )


@app.get("/data", response_model=DataResponse, tags=["Data"])
async def get_data(
    country: Optional[str] = Query(None, description="Filter by country name"),
    iso: Optional[str] = Query(None, description="Filter by ISO 3166-1 alpha-3 code"),
    continent: Optional[Continent] = Query(None, description="Filter by continent"),
    year: Optional[int] = Query(None, description="Filter by specific year"),
    year_start: Optional[int] = Query(None, description="Start year (inclusive)"),
    year_end: Optional[int] = Query(None, description="End year (inclusive)"),
    sector: Optional[Sector] = Query(None, description="Filter by sector"),
    gas: Optional[GasType] = Query(None, description="Filter by gas type"),
    min_emissions: Optional[float] = Query(None, description="Minimum emission value"),
    limit: int = Query(1000, ge=1, le=10000, description="Maximum records to return"),
    offset: int = Query(0, ge=0, description="Number of records to skip"),
    sort_by: Optional[str] = Query("year", description="Column to sort by"),
    sort_desc: bool = Query(True, description="Sort descending"),
):
    """
    Retrieve emissions data with comprehensive filtering options.
    
    Returns paginated results with applied filters metadata.
    """
    df = data_manager.load_emissions()
    filters_applied = {}
    
    # Apply filters
    if country:
        df = df[df['country'].str.lower() == country.lower()]
        filters_applied['country'] = country
    
    if iso:
        df = df[df['iso'].str.upper() == iso.upper()]
        filters_applied['iso'] = iso
    
    if continent and continent != Continent.ALL:
        df = df[df['continent'] == continent.value]
        filters_applied['continent'] = continent.value
    
    if year:
        df = df[df['year'] == year]
        filters_applied['year'] = year
    else:
        if year_start:
            df = df[df['year'] >= year_start]
            filters_applied['year_start'] = year_start
        if year_end:
            df = df[df['year'] <= year_end]
            filters_applied['year_end'] = year_end
    
    if sector and sector != Sector.ALL and 'sector' in df.columns:
        df = df[df['sector'] == sector.value]
        filters_applied['sector'] = sector.value
    
    if min_emissions and 'ghg_total_mt' in df.columns:
        df = df[df['ghg_total_mt'] >= min_emissions]
        filters_applied['min_emissions'] = min_emissions
    
    # Sort
    if sort_by in df.columns:
        df = df.sort_values(sort_by, ascending=not sort_desc)
    
    # Paginate
    total = len(df)
    df = df.iloc[offset:offset + limit]
    
    # Handle NaN values for JSON serialization
    df = df.replace({np.nan: None})
    
    return DataResponse(
        total_records=total,
        filters_applied=filters_applied,
        data=df.to_dict(orient='records')
    )


@app.post("/query", response_model=QueryResponse, tags=["AI"])
async def query_data(request: QueryRequest):
    """
    AI-powered natural language query endpoint.
    
    Uses GPT-4/GPT-5 via LangChain to answer questions about emissions data.
    Optionally includes web search for recent information via Tavily.
    """
    context = data_manager.get_data_context()
    
    return await ai_service.query(
        question=request.query,
        data_context=context,
        include_web=request.include_web_search,
        conversation_id=request.conversation_id
    )


@app.get("/insights", response_model=InsightResponse, tags=["Analytics"])
async def get_insights(
    year: Optional[int] = Query(None, description="Year for insights (default: latest)")
):
    """
    Get auto-generated insights for a specific year.
    
    Returns key statistics, trends, and findings.
    """
    df = data_manager.load_emissions()
    
    # Determine year
    if year is None:
        year = int(df['year'].max())
    
    year_data = df[df['year'] == year]
    prev_year_data = df[df['year'] == year - 1]
    
    if year_data.empty:
        raise HTTPException(status_code=404, detail=f"No data available for year {year}")
    
    # Calculate metrics
    global_emissions = 0.0
    top_emitters = []
    
    if 'ghg_total_mt' in df.columns:
        global_emissions = float(year_data['ghg_total_mt'].sum())
        
        top = year_data.nlargest(10, 'ghg_total_mt')[['country', 'ghg_total_mt', 'continent', 'iso']]
        top_emitters = top.replace({np.nan: None}).to_dict('records')
    
    # Year-over-year change
    prev_total = float(prev_year_data['ghg_total_mt'].sum()) if 'ghg_total_mt' in df.columns and not prev_year_data.empty else global_emissions
    yoy_change = ((global_emissions - prev_total) / prev_total * 100) if prev_total > 0 else 0.0
    
    # Continent breakdown
    continent_breakdown = {}
    if 'continent' in year_data.columns and 'ghg_total_mt' in year_data.columns:
        continent_totals = year_data.groupby('continent')['ghg_total_mt'].sum()
        continent_breakdown = {k: float(v) for k, v in continent_totals.items()}
    
    # Sector breakdown
    sector_breakdown = None
    sector_df = data_manager.load_sector_data()
    if not sector_df.empty:
        sector_year = sector_df[sector_df['year'] == year]
        if not sector_year.empty and 'sector' in sector_year.columns:
            sector_totals = sector_year.groupby('sector')['emission_value'].sum()
            sector_breakdown = {k: float(v) for k, v in sector_totals.items()}
    
    # Generate key findings
    findings = [
        f"Global GHG emissions in {year}: {global_emissions:,.1f} Mt CO2e",
        f"Year-over-year change: {yoy_change:+.1f}%",
    ]
    
    if top_emitters:
        top_share = (top_emitters[0]['ghg_total_mt'] / global_emissions * 100) if global_emissions > 0 else 0
        findings.append(f"Top emitter ({top_emitters[0]['country']}): {top_share:.1f}% of global emissions")
    
    findings.append(f"Countries reporting: {year_data['country'].nunique()}")
    
    if continent_breakdown:
        max_continent = max(continent_breakdown, key=continent_breakdown.get)
        findings.append(f"Highest emitting region: {max_continent}")
    
    return InsightResponse(
        year=year,
        global_emissions_mt=global_emissions,
        yoy_change_percent=round(yoy_change, 2),
        top_emitters=top_emitters,
        continent_breakdown=continent_breakdown,
        sector_breakdown=sector_breakdown,
        key_findings=findings,
        generated_at=datetime.now().isoformat()
    )


@app.get("/countries", tags=["Reference"])
async def list_countries(
    continent: Optional[Continent] = Query(None, description="Filter by continent")
):
    """List all countries in the dataset."""
    df = data_manager.load_emissions()
    
    if continent and continent != Continent.ALL:
        df = df[df['continent'] == continent.value]
    
    countries = df[['country', 'iso', 'continent']].drop_duplicates()
    countries = countries.sort_values('country')
    
    return {
        "total": len(countries),
        "countries": countries.replace({np.nan: None}).to_dict('records')
    }


@app.get("/years", tags=["Reference"])
async def list_years():
    """List all available years in the dataset."""
    df = data_manager.load_emissions()
    years = sorted(df['year'].unique().tolist())
    
    return {
        "years": [int(y) for y in years],
        "min": int(min(years)),
        "max": int(max(years)),
        "count": len(years)
    }


@app.get("/sectors", tags=["Reference"])
async def list_sectors():
    """List all emission sectors."""
    sector_df = data_manager.load_sector_data()
    
    if sector_df.empty or 'sector' not in sector_df.columns:
        return {
            "sectors": [s.value for s in Sector if s != Sector.ALL],
            "note": "Standard sectors (detailed sector data may not be available)"
        }
    
    sectors = sector_df['sector'].unique().tolist()
    return {"sectors": sorted(sectors)}


@app.get("/download", tags=["Data"])
async def download_data(
    format: str = Query("csv", enum=["csv", "json"]),
    country: Optional[str] = None,
    year: Optional[int] = None,
):
    """Download emissions data as CSV or JSON file."""
    df = data_manager.load_emissions()
    
    if country:
        df = df[df['country'].str.lower() == country.lower()]
    if year:
        df = df[df['year'] == year]
    
    filename = f"emissions_data_{datetime.now().strftime('%Y%m%d')}"
    
    if format == "csv":
        output = io.StringIO()
        df.to_csv(output, index=False)
        output.seek(0)
        
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}.csv"}
        )
    else:
        return df.replace({np.nan: None}).to_dict(orient='records')


@app.post("/cache/invalidate", tags=["Admin"])
async def invalidate_cache():
    """Invalidate data cache to force reload on next request."""
    data_manager.invalidate_cache()
    return {"message": "Cache invalidated", "status": "success"}


# ============================================================================
# MAIN ENTRY POINT
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    
    logger.info(f"Starting server on {host}:{port}")
    
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=os.getenv("ENV", "development") == "development",
        log_level="info"
    )
