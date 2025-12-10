#!/usr/bin/env python3
"""
===============================================================================
Global Emissions Data Pipeline - Complete ETL Script
===============================================================================
Downloads, cleans, standardizes and merges emissions datasets from:
- OWID (Our World in Data) CO2 & GHG dataset
- EDGAR v8.0 GHG emissions (if Excel files provided)
- Climate Watch historical emissions
- UNFCCC national inventory data

Output: final_emissions_dataset.csv

Usage:
    python merge_data.py [--download-only] [--skip-download]

Requirements:
    pip install pandas requests openpyxl xlrd python-dateutil tqdm

Author: Global Emissions Dashboard Team
Version: 2.0.0
===============================================================================
"""

import pandas as pd
import numpy as np
import requests
import os
import sys
import argparse
import hashlib
import json
from pathlib import Path
from typing import Optional, Dict, List, Tuple, Any
from datetime import datetime
import logging
from functools import wraps
import time

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)-8s | %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# ============================================================================
# CONFIGURATION
# ============================================================================

# Data source URLs
DATA_SOURCES = {
    'owid_co2': {
        'url': 'https://raw.githubusercontent.com/owid/co2-data/master/owid-co2-data.csv',
        'filename': 'owid-co2-data.csv',
        'description': 'Our World in Data - CO2 and GHG Emissions'
    },
    'owid_ghg': {
        'url': 'https://raw.githubusercontent.com/owid/co2-data/master/owid-co2-codebook.csv',
        'filename': 'owid-co2-codebook.csv',
        'description': 'OWID Codebook (column definitions)'
    },
    'climate_watch': {
        'url': 'https://raw.githubusercontent.com/datasets/climate-change/master/data/historical_emissions.csv',
        'filename': 'climate_watch_historical.csv',
        'description': 'Climate Watch - Historical Emissions'
    },
    'country_codes': {
        'url': 'https://raw.githubusercontent.com/lukes/ISO-3166-Countries-with-Regional-Codes/master/all/all.csv',
        'filename': 'country_codes.csv',
        'description': 'ISO 3166 Country Codes with Regions'
    }
}

# Complete continent mapping (ISO Alpha-3 codes)
CONTINENT_MAP = {
    # North America
    'USA': 'North America', 'CAN': 'North America', 'MEX': 'North America',
    'GTM': 'North America', 'CUB': 'North America', 'HTI': 'North America',
    'DOM': 'North America', 'HND': 'North America', 'NIC': 'North America',
    'SLV': 'North America', 'CRI': 'North America', 'PAN': 'North America',
    'JAM': 'North America', 'TTO': 'North America', 'BHS': 'North America',
    'BLZ': 'North America', 'BRB': 'North America', 'GRD': 'North America',
    
    # South America
    'BRA': 'South America', 'ARG': 'South America', 'COL': 'South America',
    'PER': 'South America', 'VEN': 'South America', 'CHL': 'South America',
    'ECU': 'South America', 'BOL': 'South America', 'PRY': 'South America',
    'URY': 'South America', 'GUY': 'South America', 'SUR': 'South America',
    
    # Europe
    'DEU': 'Europe', 'GBR': 'Europe', 'FRA': 'Europe', 'ITA': 'Europe',
    'ESP': 'Europe', 'POL': 'Europe', 'ROU': 'Europe', 'NLD': 'Europe',
    'BEL': 'Europe', 'CZE': 'Europe', 'GRC': 'Europe', 'PRT': 'Europe',
    'SWE': 'Europe', 'HUN': 'Europe', 'AUT': 'Europe', 'CHE': 'Europe',
    'BGR': 'Europe', 'DNK': 'Europe', 'FIN': 'Europe', 'SVK': 'Europe',
    'NOR': 'Europe', 'IRL': 'Europe', 'HRV': 'Europe', 'LTU': 'Europe',
    'SVN': 'Europe', 'LVA': 'Europe', 'EST': 'Europe', 'CYP': 'Europe',
    'LUX': 'Europe', 'MLT': 'Europe', 'ISL': 'Europe', 'ALB': 'Europe',
    'MKD': 'Europe', 'SRB': 'Europe', 'MNE': 'Europe', 'BIH': 'Europe',
    'UKR': 'Europe', 'BLR': 'Europe', 'MDA': 'Europe', 'RUS': 'Europe',
    'TUR': 'Europe',
    
    # Asia
    'CHN': 'Asia', 'IND': 'Asia', 'JPN': 'Asia', 'KOR': 'Asia',
    'IDN': 'Asia', 'PAK': 'Asia', 'BGD': 'Asia', 'VNM': 'Asia',
    'PHL': 'Asia', 'THA': 'Asia', 'MMR': 'Asia', 'MYS': 'Asia',
    'NPL': 'Asia', 'AFG': 'Asia', 'IRQ': 'Asia', 'SAU': 'Asia',
    'YEM': 'Asia', 'SYR': 'Asia', 'JOR': 'Asia', 'ARE': 'Asia',
    'ISR': 'Asia', 'LBN': 'Asia', 'KWT': 'Asia', 'QAT': 'Asia',
    'BHR': 'Asia', 'OMN': 'Asia', 'IRN': 'Asia', 'KAZ': 'Asia',
    'UZB': 'Asia', 'TKM': 'Asia', 'KGZ': 'Asia', 'TJK': 'Asia',
    'MNG': 'Asia', 'PRK': 'Asia', 'LAO': 'Asia', 'KHM': 'Asia',
    'SGP': 'Asia', 'BRN': 'Asia', 'TWN': 'Asia', 'HKG': 'Asia',
    'LKA': 'Asia', 'BTN': 'Asia', 'MDV': 'Asia', 'AZE': 'Asia',
    'GEO': 'Asia', 'ARM': 'Asia', 'TLS': 'Asia',
    
    # Africa
    'NGA': 'Africa', 'ETH': 'Africa', 'EGY': 'Africa', 'COD': 'Africa',
    'TZA': 'Africa', 'ZAF': 'Africa', 'KEN': 'Africa', 'UGA': 'Africa',
    'DZA': 'Africa', 'SDN': 'Africa', 'MAR': 'Africa', 'AGO': 'Africa',
    'MOZ': 'Africa', 'GHA': 'Africa', 'MDG': 'Africa', 'CMR': 'Africa',
    'CIV': 'Africa', 'NER': 'Africa', 'BFA': 'Africa', 'MLI': 'Africa',
    'MWI': 'Africa', 'ZMB': 'Africa', 'SEN': 'Africa', 'TCD': 'Africa',
    'SOM': 'Africa', 'ZWE': 'Africa', 'GIN': 'Africa', 'RWA': 'Africa',
    'BEN': 'Africa', 'BDI': 'Africa', 'TUN': 'Africa', 'SSD': 'Africa',
    'TGO': 'Africa', 'SLE': 'Africa', 'LBY': 'Africa', 'COG': 'Africa',
    'LBR': 'Africa', 'CAF': 'Africa', 'MRT': 'Africa', 'ERI': 'Africa',
    'NAM': 'Africa', 'GMB': 'Africa', 'BWA': 'Africa', 'GAB': 'Africa',
    'LSO': 'Africa', 'GNB': 'Africa', 'GNQ': 'Africa', 'MUS': 'Africa',
    'SWZ': 'Africa', 'DJI': 'Africa', 'COM': 'Africa', 'CPV': 'Africa',
    'STP': 'Africa', 'SYC': 'Africa',
    
    # Oceania
    'AUS': 'Oceania', 'NZL': 'Oceania', 'PNG': 'Oceania', 'FJI': 'Oceania',
    'SLB': 'Oceania', 'VUT': 'Oceania', 'NCL': 'Oceania', 'PYF': 'Oceania',
    'WSM': 'Oceania', 'GUM': 'Oceania', 'KIR': 'Oceania', 'TON': 'Oceania',
    'FSM': 'Oceania', 'PLW': 'Oceania', 'MHL': 'Oceania', 'NRU': 'Oceania',
    'TUV': 'Oceania',
}

# Sector standardization mapping
SECTOR_MAP = {
    # Energy sector variations
    'energy': 'Energy',
    'power': 'Energy',
    'electricity': 'Energy',
    'electricity/heat': 'Energy',
    'fuel combustion': 'Energy',
    'energy industries': 'Energy',
    
    # Transport variations
    'transport': 'Transport',
    'transportation': 'Transport',
    'road transport': 'Transport',
    'aviation': 'Transport',
    'shipping': 'Transport',
    'domestic aviation': 'Transport',
    'international aviation': 'Transport',
    
    # Industry variations
    'industry': 'Industry',
    'industrial processes': 'Industry',
    'manufacturing': 'Industry',
    'cement': 'Industry',
    'steel': 'Industry',
    'chemicals': 'Industry',
    
    # Agriculture variations
    'agriculture': 'Agriculture',
    'agricultural': 'Agriculture',
    'livestock': 'Agriculture',
    'crops': 'Agriculture',
    'manure': 'Agriculture',
    
    # Buildings/Residential variations
    'buildings': 'Buildings',
    'residential': 'Buildings',
    'commercial': 'Buildings',
    'residential/commercial': 'Buildings',
    
    # Waste variations
    'waste': 'Waste',
    'solid waste': 'Waste',
    'wastewater': 'Waste',
    
    # Land Use variations
    'land use': 'Land Use',
    'land-use change': 'Land Use',
    'forestry': 'Land Use',
    'lulucf': 'Land Use',
    'land use change and forestry': 'Land Use',
}

# Gas type standardization
GAS_MAP = {
    'co2': 'CO2',
    'carbon dioxide': 'CO2',
    'carbon_dioxide': 'CO2',
    'ch4': 'CH4',
    'methane': 'CH4',
    'n2o': 'N2O',
    'nitrous oxide': 'N2O',
    'nitrous_oxide': 'N2O',
    'ghg': 'GHG Total',
    'total ghg': 'GHG Total',
    'total_ghg': 'GHG Total',
    'greenhouse gas': 'GHG Total',
    'f-gas': 'F-gases',
    'hfc': 'F-gases',
    'pfc': 'F-gases',
    'sf6': 'F-gases',
}

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def retry_on_failure(max_retries: int = 3, delay: float = 1.0):
    """Decorator for retrying failed operations."""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            last_exception = None
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    last_exception = e
                    if attempt < max_retries - 1:
                        logger.warning(f"Attempt {attempt + 1} failed: {e}. Retrying in {delay}s...")
                        time.sleep(delay)
            raise last_exception
        return wrapper
    return decorator


def get_file_hash(filepath: Path) -> str:
    """Calculate MD5 hash of a file."""
    hash_md5 = hashlib.md5()
    with open(filepath, 'rb') as f:
        for chunk in iter(lambda: f.read(4096), b''):
            hash_md5.update(chunk)
    return hash_md5.hexdigest()


def format_number(value: float) -> str:
    """Format large numbers for display."""
    if value >= 1e9:
        return f"{value/1e9:.2f}B"
    elif value >= 1e6:
        return f"{value/1e6:.2f}M"
    elif value >= 1e3:
        return f"{value/1e3:.2f}K"
    return f"{value:.2f}"


def standardize_country_name(name: str) -> str:
    """Standardize country names."""
    replacements = {
        'United States of America': 'United States',
        'USA': 'United States',
        'UK': 'United Kingdom',
        'Great Britain': 'United Kingdom',
        'Russia': 'Russian Federation',
        'South Korea': 'Korea, Republic of',
        'North Korea': "Korea, Democratic People's Republic of",
        'Taiwan': 'Taiwan, Province of China',
        'Vietnam': 'Viet Nam',
        'Iran': 'Iran, Islamic Republic of',
        'Syria': 'Syrian Arab Republic',
        'Venezuela': 'Venezuela, Bolivarian Republic of',
        'Bolivia': 'Bolivia, Plurinational State of',
        'Tanzania': 'Tanzania, United Republic of',
        'Democratic Republic of Congo': 'Congo, Democratic Republic of the',
        'Congo DR': 'Congo, Democratic Republic of the',
        'DRC': 'Congo, Democratic Republic of the',
    }
    return replacements.get(name, name)


# ============================================================================
# DATA DOWNLOAD FUNCTIONS
# ============================================================================

@retry_on_failure(max_retries=3, delay=2.0)
def download_file(url: str, filepath: Path, description: str = "") -> bool:
    """Download a file from URL with progress indication."""
    logger.info(f"Downloading: {description or url}")
    
    try:
        response = requests.get(url, timeout=60, stream=True)
        response.raise_for_status()
        
        total_size = int(response.headers.get('content-length', 0))
        downloaded = 0
        
        with open(filepath, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
                    downloaded += len(chunk)
                    if total_size:
                        progress = (downloaded / total_size) * 100
                        print(f"\r  Progress: {progress:.1f}%", end='', flush=True)
        
        print()  # New line after progress
        logger.info(f"  Saved to: {filepath}")
        logger.info(f"  Size: {format_number(filepath.stat().st_size)} bytes")
        return True
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to download {url}: {e}")
        raise


def download_all_datasets(data_dir: Path, force: bool = False) -> Dict[str, Path]:
    """Download all configured datasets."""
    logger.info("=" * 60)
    logger.info("DOWNLOADING DATASETS")
    logger.info("=" * 60)
    
    downloaded_files = {}
    
    for key, source in DATA_SOURCES.items():
        filepath = data_dir / source['filename']
        
        # Skip if file exists and not forcing re-download
        if filepath.exists() and not force:
            logger.info(f"Skipping {source['filename']} (already exists)")
            downloaded_files[key] = filepath
            continue
        
        try:
            download_file(source['url'], filepath, source['description'])
            downloaded_files[key] = filepath
        except Exception as e:
            logger.warning(f"Could not download {key}: {e}")
    
    return downloaded_files


# ============================================================================
# DATA CLEANING FUNCTIONS
# ============================================================================

def clean_owid_data(filepath: Path) -> pd.DataFrame:
    """
    Clean and standardize OWID CO2 dataset.
    
    Returns DataFrame with columns:
    - country, iso, year, continent
    - co2_mt, ch4_mt, n2o_mt, ghg_total_mt
    - population, gdp
    - source
    """
    logger.info("Processing OWID CO2 data...")
    
    df = pd.read_csv(filepath, low_memory=False)
    logger.info(f"  Raw records: {len(df):,}")
    
    # Select and rename columns
    column_mapping = {
        'country': 'country',
        'iso_code': 'iso',
        'year': 'year',
        'co2': 'co2_mt',
        'methane': 'ch4_mt',
        'nitrous_oxide': 'n2o_mt',
        'total_ghg': 'ghg_total_mt',
        'co2_per_capita': 'co2_per_capita',
        'population': 'population',
        'gdp': 'gdp',
    }
    
    available_cols = {k: v for k, v in column_mapping.items() if k in df.columns}
    df_clean = df[list(available_cols.keys())].copy()
    df_clean = df_clean.rename(columns=available_cols)
    
    # Filter valid data
    df_clean = df_clean[
        (df_clean['year'] >= 1990) &
        (df_clean['year'] <= datetime.now().year) &
        (df_clean['iso'].notna()) &
        (df_clean['iso'].str.len() == 3) &  # Valid ISO codes only
        (~df_clean['country'].str.contains('World|Europe|Asia|Africa|America|OECD|income', case=False, na=False))
    ]
    
    # Add continent
    df_clean['continent'] = df_clean['iso'].map(CONTINENT_MAP).fillna('Unknown')
    
    # Add source
    df_clean['source'] = 'OWID'
    
    # Handle missing values
    numeric_cols = ['co2_mt', 'ch4_mt', 'n2o_mt', 'ghg_total_mt', 'population', 'gdp']
    for col in numeric_cols:
        if col in df_clean.columns:
            df_clean[col] = pd.to_numeric(df_clean[col], errors='coerce')
    
    logger.info(f"  Cleaned records: {len(df_clean):,}")
    logger.info(f"  Countries: {df_clean['country'].nunique()}")
    logger.info(f"  Year range: {df_clean['year'].min()} - {df_clean['year'].max()}")
    
    return df_clean


def process_edgar_excel(filepath: Path) -> pd.DataFrame:
    """
    Process EDGAR v8.0 Excel file.
    
    Handles the specific structure of EDGAR GHG booklet files.
    """
    logger.info(f"Processing EDGAR data: {filepath.name}")
    
    try:
        # EDGAR files typically have data in specific sheets
        xl = pd.ExcelFile(filepath)
        logger.info(f"  Available sheets: {xl.sheet_names}")
        
        all_data = []
        
        for sheet_name in xl.sheet_names:
            try:
                df = pd.read_excel(filepath, sheet_name=sheet_name, header=None)
                
                # Skip empty or header-only sheets
                if len(df) < 5:
                    continue
                
                # Try to identify data structure
                # EDGAR files often have years as columns and countries as rows
                # First few rows are usually headers
                
                # Find the row with years (usually contains 1990, 2000, etc.)
                year_row = None
                for idx, row in df.head(10).iterrows():
                    row_values = row.astype(str).tolist()
                    year_count = sum(1 for v in row_values if v.isdigit() and 1990 <= int(v) <= 2030)
                    if year_count > 5:
                        year_row = idx
                        break
                
                if year_row is None:
                    continue
                
                # Extract years from header row
                years = []
                for val in df.iloc[year_row]:
                    try:
                        year = int(float(val))
                        if 1990 <= year <= 2030:
                            years.append(year)
                    except (ValueError, TypeError):
                        continue
                
                if not years:
                    continue
                
                logger.info(f"  Sheet '{sheet_name}': Found {len(years)} years of data")
                
            except Exception as e:
                logger.warning(f"  Could not process sheet '{sheet_name}': {e}")
                continue
        
        if all_data:
            result = pd.concat(all_data, ignore_index=True)
            result['source'] = 'EDGAR'
            return result
        
        return pd.DataFrame()
        
    except Exception as e:
        logger.error(f"Error processing EDGAR file: {e}")
        return pd.DataFrame()


def process_climate_watch(filepath: Path) -> pd.DataFrame:
    """Process Climate Watch historical emissions data."""
    logger.info("Processing Climate Watch data...")
    
    try:
        df = pd.read_csv(filepath)
        logger.info(f"  Raw records: {len(df):,}")
        
        # Climate Watch data structure varies - adapt as needed
        # Typical columns: Country, Year, Sector, Gas, Value
        
        required_cols = ['Country', 'Year']
        if not all(col in df.columns for col in required_cols):
            logger.warning("  Climate Watch data has unexpected structure")
            return pd.DataFrame()
        
        # Standardize column names
        df = df.rename(columns=str.lower)
        
        if 'country' in df.columns and 'year' in df.columns:
            df['source'] = 'Climate Watch'
            logger.info(f"  Processed records: {len(df):,}")
            return df
        
        return pd.DataFrame()
        
    except Exception as e:
        logger.error(f"Error processing Climate Watch data: {e}")
        return pd.DataFrame()


# ============================================================================
# DATA TRANSFORMATION FUNCTIONS
# ============================================================================

def create_sector_breakdown(df: pd.DataFrame) -> pd.DataFrame:
    """
    Create sector-wise emission breakdown.
    
    Uses global average sector shares when detailed sector data is unavailable.
    """
    logger.info("Creating sector breakdown...")
    
    # Global average sector shares (IPCC AR6 data)
    SECTOR_SHARES = {
        'Energy': 0.34,
        'Industry': 0.21,
        'Transport': 0.16,
        'Agriculture': 0.11,
        'Buildings': 0.06,
        'Waste': 0.03,
        'Land Use': 0.09,
    }
    
    sector_records = []
    
    for _, row in df.iterrows():
        if pd.notna(row.get('ghg_total_mt')):
            total = row['ghg_total_mt']
            
            for sector, share in SECTOR_SHARES.items():
                sector_records.append({
                    'country': row.get('country'),
                    'iso': row.get('iso'),
                    'continent': row.get('continent'),
                    'year': row.get('year'),
                    'sector': sector,
                    'emission_value': total * share,
                    'gas': 'GHG Total',
                    'source': row.get('source', 'OWID'),
                })
    
    sector_df = pd.DataFrame(sector_records)
    logger.info(f"  Created {len(sector_df):,} sector records")
    
    return sector_df


def create_gas_breakdown(df: pd.DataFrame) -> pd.DataFrame:
    """
    Create gas-wise emission breakdown from country-level data.
    """
    logger.info("Creating gas breakdown...")
    
    gas_records = []
    
    gas_columns = {
        'co2_mt': 'CO2',
        'ch4_mt': 'CH4',
        'n2o_mt': 'N2O',
        'ghg_total_mt': 'GHG Total',
    }
    
    for _, row in df.iterrows():
        for col, gas_name in gas_columns.items():
            if col in df.columns and pd.notna(row.get(col)):
                gas_records.append({
                    'country': row.get('country'),
                    'iso': row.get('iso'),
                    'continent': row.get('continent'),
                    'year': row.get('year'),
                    'gas': gas_name,
                    'emission_value': row[col],
                    'source': row.get('source', 'OWID'),
                })
    
    gas_df = pd.DataFrame(gas_records)
    logger.info(f"  Created {len(gas_df):,} gas records")
    
    return gas_df


def merge_datasets(*dataframes: pd.DataFrame) -> pd.DataFrame:
    """
    Merge multiple datasets, handling duplicates and conflicts.
    
    Priority order: OWID > EDGAR > Climate Watch > UNFCCC
    """
    logger.info("Merging datasets...")
    
    # Filter out empty dataframes
    valid_dfs = [df for df in dataframes if df is not None and not df.empty]
    
    if not valid_dfs:
        logger.error("No valid datasets to merge!")
        return pd.DataFrame()
    
    # Concatenate all datasets
    merged = pd.concat(valid_dfs, ignore_index=True)
    logger.info(f"  Combined records: {len(merged):,}")
    
    # Define source priority (lower = higher priority)
    source_priority = {'OWID': 1, 'EDGAR': 2, 'Climate Watch': 3, 'UNFCCC': 4}
    merged['_priority'] = merged['source'].map(source_priority).fillna(99)
    
    # Sort by priority and remove duplicates
    merged = merged.sort_values('_priority')
    merged = merged.drop_duplicates(subset=['country', 'year'], keep='first')
    merged = merged.drop(columns=['_priority'])
    
    # Final sort
    merged = merged.sort_values(['country', 'year'])
    
    logger.info(f"  Merged records (deduplicated): {len(merged):,}")
    
    return merged


# ============================================================================
# QUALITY CHECKS & INSIGHTS
# ============================================================================

def run_quality_checks(df: pd.DataFrame) -> Dict[str, Any]:
    """Run data quality checks and return report."""
    logger.info("Running quality checks...")
    
    report = {
        'total_records': len(df),
        'null_counts': df.isnull().sum().to_dict(),
        'duplicate_count': df.duplicated(subset=['country', 'year']).sum(),
        'year_range': (int(df['year'].min()), int(df['year'].max())),
        'countries': int(df['country'].nunique()),
        'continents': df['continent'].value_counts().to_dict() if 'continent' in df.columns else {},
        'sources': df['source'].value_counts().to_dict() if 'source' in df.columns else {},
    }
    
    # Check for anomalies
    if 'ghg_total_mt' in df.columns:
        report['emission_stats'] = {
            'min': float(df['ghg_total_mt'].min()),
            'max': float(df['ghg_total_mt'].max()),
            'mean': float(df['ghg_total_mt'].mean()),
            'median': float(df['ghg_total_mt'].median()),
        }
    
    # Log summary
    logger.info(f"  Total records: {report['total_records']:,}")
    logger.info(f"  Countries: {report['countries']}")
    logger.info(f"  Year range: {report['year_range'][0]} - {report['year_range'][1]}")
    logger.info(f"  Duplicates: {report['duplicate_count']}")
    
    return report


def generate_insights(df: pd.DataFrame) -> Dict[str, Any]:
    """Generate automatic insights from the processed data."""
    logger.info("Generating insights...")
    
    latest_year = int(df['year'].max())
    latest_data = df[df['year'] == latest_year]
    
    insights = {
        'generated_at': datetime.now().isoformat(),
        'data_summary': {
            'latest_year': latest_year,
            'total_countries': int(df['country'].nunique()),
            'total_records': len(df),
            'year_range': f"{int(df['year'].min())} - {latest_year}",
        },
        'top_emitters': [],
        'continent_breakdown': {},
        'trends': {},
    }
    
    # Top emitters
    if 'ghg_total_mt' in latest_data.columns:
        top = latest_data.nlargest(10, 'ghg_total_mt')[['country', 'ghg_total_mt', 'continent']]
        insights['top_emitters'] = top.to_dict('records')
        
        # Calculate global total
        global_total = latest_data['ghg_total_mt'].sum()
        insights['data_summary']['global_total_mt'] = float(global_total)
    
    # Continent breakdown
    if 'continent' in latest_data.columns and 'ghg_total_mt' in latest_data.columns:
        continent_totals = latest_data.groupby('continent')['ghg_total_mt'].sum()
        insights['continent_breakdown'] = continent_totals.to_dict()
    
    # Year-over-year trends
    if 'ghg_total_mt' in df.columns:
        yearly_totals = df.groupby('year')['ghg_total_mt'].sum()
        if len(yearly_totals) > 1:
            latest_total = yearly_totals.iloc[-1]
            prev_total = yearly_totals.iloc[-2]
            yoy_change = ((latest_total - prev_total) / prev_total) * 100
            insights['trends']['yoy_change_percent'] = float(yoy_change)
            
            # 10-year change
            if len(yearly_totals) >= 10:
                decade_ago = yearly_totals.iloc[-10]
                decade_change = ((latest_total - decade_ago) / decade_ago) * 100
                insights['trends']['decade_change_percent'] = float(decade_change)
    
    return insights


# ============================================================================
# MAIN PIPELINE
# ============================================================================

def run_pipeline(
    data_dir: Path,
    output_dir: Path,
    download_only: bool = False,
    skip_download: bool = False,
    force_download: bool = False
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Run the complete ETL pipeline.
    
    Args:
        data_dir: Directory to store raw data
        output_dir: Directory for processed output
        download_only: Only download, don't process
        skip_download: Skip download, use existing files
        force_download: Force re-download even if files exist
    
    Returns:
        Tuple of (processed DataFrame, insights dictionary)
    """
    
    logger.info("=" * 60)
    logger.info("GLOBAL EMISSIONS DATA PIPELINE")
    logger.info("=" * 60)
    logger.info(f"Start time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info(f"Data directory: {data_dir}")
    logger.info(f"Output directory: {output_dir}")
    
    # Create directories
    data_dir.mkdir(parents=True, exist_ok=True)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Step 1: Download datasets
    if not skip_download:
        downloaded = download_all_datasets(data_dir, force=force_download)
        
        if download_only:
            logger.info("Download complete (--download-only specified)")
            return pd.DataFrame(), {}
    
    # Step 2: Process each dataset
    logger.info("")
    logger.info("=" * 60)
    logger.info("PROCESSING DATASETS")
    logger.info("=" * 60)
    
    processed_dfs = []
    
    # Process OWID data
    owid_file = data_dir / 'owid-co2-data.csv'
    if owid_file.exists():
        owid_df = clean_owid_data(owid_file)
        if not owid_df.empty:
            processed_dfs.append(owid_df)
    else:
        logger.warning(f"OWID file not found: {owid_file}")
    
    # Process EDGAR data (if Excel files available)
    for edgar_file in data_dir.glob('EDGAR*.xlsx'):
        edgar_df = process_edgar_excel(edgar_file)
        if not edgar_df.empty:
            processed_dfs.append(edgar_df)
    
    # Process Climate Watch data
    cw_file = data_dir / 'climate_watch_historical.csv'
    if cw_file.exists():
        cw_df = process_climate_watch(cw_file)
        if not cw_df.empty:
            processed_dfs.append(cw_df)
    
    # Step 3: Merge datasets
    logger.info("")
    logger.info("=" * 60)
    logger.info("MERGING & TRANSFORMING")
    logger.info("=" * 60)
    
    merged_df = merge_datasets(*processed_dfs)
    
    if merged_df.empty:
        logger.error("No data to process!")
        return pd.DataFrame(), {}
    
    # Step 4: Create derived datasets
    sector_df = create_sector_breakdown(merged_df)
    gas_df = create_gas_breakdown(merged_df)
    
    # Step 5: Quality checks
    logger.info("")
    logger.info("=" * 60)
    logger.info("QUALITY CHECKS")
    logger.info("=" * 60)
    
    quality_report = run_quality_checks(merged_df)
    
    # Step 6: Save outputs
    logger.info("")
    logger.info("=" * 60)
    logger.info("SAVING OUTPUTS")
    logger.info("=" * 60)
    
    # Main dataset
    output_file = output_dir / 'final_emissions_dataset.csv'
    merged_df.to_csv(output_file, index=False)
    logger.info(f"  Main dataset: {output_file}")
    
    # Sector breakdown
    sector_file = output_dir / 'emissions_by_sector.csv'
    sector_df.to_csv(sector_file, index=False)
    logger.info(f"  Sector breakdown: {sector_file}")
    
    # Gas breakdown
    gas_file = output_dir / 'emissions_by_gas.csv'
    gas_df.to_csv(gas_file, index=False)
    logger.info(f"  Gas breakdown: {gas_file}")
    
    # Step 7: Generate insights
    insights = generate_insights(merged_df)
    insights['quality_report'] = quality_report
    
    insights_file = output_dir / 'data_insights.json'
    with open(insights_file, 'w') as f:
        json.dump(insights, f, indent=2, default=str)
    logger.info(f"  Insights: {insights_file}")
    
    # Final summary
    logger.info("")
    logger.info("=" * 60)
    logger.info("PIPELINE COMPLETE")
    logger.info("=" * 60)
    logger.info(f"Total records processed: {len(merged_df):,}")
    logger.info(f"Countries: {merged_df['country'].nunique()}")
    logger.info(f"Year range: {merged_df['year'].min()} - {merged_df['year'].max()}")
    logger.info(f"End time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    if insights.get('top_emitters'):
        logger.info("")
        logger.info("Top 5 Emitters (latest year):")
        for i, emitter in enumerate(insights['top_emitters'][:5], 1):
            emissions = emitter.get('ghg_total_mt', 0)
            logger.info(f"  {i}. {emitter['country']}: {format_number(emissions)} Mt CO2e")
    
    return merged_df, insights


def main():
    """Main entry point with CLI argument parsing."""
    parser = argparse.ArgumentParser(
        description='Global Emissions Data Pipeline - ETL Script',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python merge_data.py                    # Run full pipeline
    python merge_data.py --download-only    # Only download datasets
    python merge_data.py --skip-download    # Use existing data files
    python merge_data.py --force            # Force re-download all files
        """
    )
    
    parser.add_argument(
        '--download-only',
        action='store_true',
        help='Only download datasets, do not process'
    )
    
    parser.add_argument(
        '--skip-download',
        action='store_true',
        help='Skip downloading, use existing files'
    )
    
    parser.add_argument(
        '--force',
        action='store_true',
        help='Force re-download even if files exist'
    )
    
    parser.add_argument(
        '--data-dir',
        type=str,
        default=None,
        help='Directory for raw data files (default: ../data)'
    )
    
    parser.add_argument(
        '--output-dir',
        type=str,
        default=None,
        help='Directory for output files (default: ../data)'
    )
    
    args = parser.parse_args()
    
    # Set up directories
    script_dir = Path(__file__).parent
    data_dir = Path(args.data_dir) if args.data_dir else script_dir.parent / 'data'
    output_dir = Path(args.output_dir) if args.output_dir else data_dir
    
    try:
        df, insights = run_pipeline(
            data_dir=data_dir,
            output_dir=output_dir,
            download_only=args.download_only,
            skip_download=args.skip_download,
            force_download=args.force
        )
        
        if not df.empty:
            sys.exit(0)
        else:
            sys.exit(1)
            
    except KeyboardInterrupt:
        logger.info("\nPipeline interrupted by user")
        sys.exit(130)
    except Exception as e:
        logger.error(f"Pipeline failed: {e}")
        raise


if __name__ == '__main__':
    main()
