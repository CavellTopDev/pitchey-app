# Pitchey Python SDK

Official Python SDK for the Pitchey API - the comprehensive movie pitch platform designed for data analysis and automation.

[![PyPI version](https://badge.fury.io/py/pitchey-sdk.svg)](https://badge.fury.io/py/pitchey-sdk)
[![Python Support](https://img.shields.io/pypi/pyversions/pitchey-sdk.svg)](https://pypi.org/project/pitchey-sdk/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- 🐍 **Full async/await support** for modern Python applications
- 📊 **Data analysis tools** with pandas, numpy, and matplotlib integration
- 🔐 **Multi-portal authentication** (Creator, Investor, Production Company)
- 🎬 **Complete pitch management** with comprehensive filtering
- 💬 **Real-time messaging** and notification handling
- 📄 **NDA workflows** and document management
- 💰 **Investment tracking** and portfolio analytics
- 📈 **Built-in analytics** and visualization tools
- 🔍 **Advanced search** capabilities
- 📁 **Media upload** support
- ⚡ **Automatic retries** and robust error handling
- 🧪 **Comprehensive testing** with pytest
- 📖 **Type hints** for better IDE support

## Installation

```bash
pip install pitchey-sdk
```

For data analysis features:
```bash
pip install pitchey-sdk[analysis]
```

For development:
```bash
pip install pitchey-sdk[dev]
```

## Quick Start

### Basic Usage

```python
import asyncio
from pitchey_sdk import PitcheySDK

async def main():
    # Initialize the SDK
    pitchey = PitcheySDK()
    
    # Authenticate
    auth = await pitchey.auth.login("user@example.com", "password123")
    print(f"Logged in as: {auth['user']['username']}")
    
    # Get public pitches
    pitches = await pitchey.pitches.get_public(limit=10, genre="sci-fi")
    print(f"Found {len(pitches['data'])} sci-fi pitches")
    
    # Print pitch titles
    for pitch in pitches['data']:
        print(f"- {pitch['title']} by {pitch['user']['username']}")
    
    await pitchey.close()

# Run the async function
asyncio.run(main())
```

### Context Manager (Recommended)

```python
import asyncio
from pitchey_sdk import PitcheySDK

async def main():
    async with PitcheySDK() as pitchey:
        # Authenticate with demo account
        auth = await pitchey.auth.login_demo_creator()
        
        # Create a new pitch
        pitch = await pitchey.pitches.create({
            "title": "The Last Star",
            "logline": "A space exploration thriller...",
            "genre": "Sci-Fi Thriller", 
            "format": "feature",
            "seeking_investment": True
        })
        
        print(f"Created pitch: {pitch['pitch']['title']}")

asyncio.run(main())
```

### Factory Methods

```python
from pitchey_sdk import PitcheySDK

# Production environment
pitchey = PitcheySDK.production("your-api-key")

# Development environment  
pitchey = PitcheySDK.development("your-api-key")

# Demo account (automatically authenticated)
pitchey = await PitcheySDK.demo("creator")

# Public access (no authentication)
pitchey = PitcheySDK.public()
```

## Data Analysis Examples

### Pitch Analytics with Pandas

```python
import asyncio
import pandas as pd
from pitchey_sdk import PitcheySDK

async def analyze_pitches():
    async with PitcheySDK.public() as pitchey:
        # Get all public pitches
        all_pitches = []
        page = 1
        
        while True:
            pitches = await pitchey.pitches.get_public(page=page, limit=100)
            if not pitches['data']:
                break
            all_pitches.extend(pitches['data'])
            page += 1
        
        # Convert to DataFrame
        df = pd.DataFrame(all_pitches)
        
        # Analyze by genre
        genre_analysis = df.groupby('genre').agg({
            'view_count': ['mean', 'sum'],
            'like_count': ['mean', 'sum'], 
            'id': 'count'
        }).round(2)
        
        print("Pitch Analytics by Genre:")
        print(genre_analysis)
        
        # Analyze budget ranges
        budget_analysis = df.groupby('budget_range')['view_count'].mean().sort_values(ascending=False)
        print("\nAverage Views by Budget Range:")
        print(budget_analysis)
        
        return df

# Run analysis
df = asyncio.run(analyze_pitches())
```

### Investment Portfolio Analysis

```python
import asyncio
import matplotlib.pyplot as plt
from pitchey_sdk import PitcheySDK

async def analyze_portfolio():
    async with PitcheySDK.demo("investor") as pitchey:
        # Get investment portfolio
        investments = await pitchey.investments.list()
        
        # Calculate portfolio metrics
        total_invested = sum(inv['amount'] for inv in investments['data'])
        total_value = sum(inv.get('current_value', inv['amount']) for inv in investments['data'])
        total_return = total_value - total_invested
        return_pct = (total_return / total_invested) * 100 if total_invested > 0 else 0
        
        print(f"Portfolio Summary:")
        print(f"Total Invested: ${total_invested:,.2f}")
        print(f"Current Value: ${total_value:,.2f}")
        print(f"Total Return: ${total_return:,.2f} ({return_pct:.1f}%)")
        
        # Visualize portfolio distribution
        investment_amounts = [inv['amount'] for inv in investments['data']]
        investment_titles = [inv['pitch']['title'] for inv in investments['data']]
        
        plt.figure(figsize=(10, 6))
        plt.pie(investment_amounts, labels=investment_titles, autopct='%1.1f%%')
        plt.title('Investment Portfolio Distribution')
        plt.savefig('portfolio_distribution.png')
        plt.show()

asyncio.run(analyze_portfolio())
```

### Market Trends Analysis

```python
import asyncio
import seaborn as sns
import matplotlib.pyplot as plt
from pitchey_sdk import PitcheySDK
from datetime import datetime, timedelta

async def analyze_market_trends():
    async with PitcheySDK.public() as pitchey:
        # Get trending pitches
        trending = await pitchey.pitches.get_trending(limit=50)
        
        # Search by different genres
        genres = ["action", "drama", "comedy", "thriller", "sci-fi", "horror"]
        genre_data = []
        
        for genre in genres:
            search_results = await pitchey.search.search(
                f"genre:{genre}", 
                filters={"seeking_investment": True}
            )
            
            genre_data.append({
                "genre": genre.title(),
                "total_pitches": search_results["total"],
                "seeking_investment": len([p for p in search_results["pitches"] if p.get("seeking_investment")]),
                "avg_views": sum(p.get("view_count", 0) for p in search_results["pitches"]) / len(search_results["pitches"]) if search_results["pitches"] else 0
            })
        
        # Create visualization
        df_trends = pd.DataFrame(genre_data)
        
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(15, 6))
        
        # Pitches by genre
        sns.barplot(data=df_trends, x="genre", y="total_pitches", ax=ax1)
        ax1.set_title("Total Pitches by Genre")
        ax1.tick_params(axis='x', rotation=45)
        
        # Average views by genre
        sns.barplot(data=df_trends, x="genre", y="avg_views", ax=ax2)
        ax2.set_title("Average Views by Genre")
        ax2.tick_params(axis='x', rotation=45)
        
        plt.tight_layout()
        plt.savefig('market_trends.png', dpi=300, bbox_inches='tight')
        plt.show()
        
        return df_trends

trends_df = asyncio.run(analyze_market_trends())
```

## Authentication

### Portal-Specific Login

```python
async def authenticate():
    async with PitcheySDK() as pitchey:
        # Creator portal
        creator_auth = await pitchey.auth.creator_login("creator@example.com", "password")
        
        # Investor portal
        investor_auth = await pitchey.auth.investor_login("investor@example.com", "password")
        
        # Production company portal
        production_auth = await pitchey.auth.production_login("production@example.com", "password")
        
        return creator_auth
```

### Demo Accounts

```python
async def use_demo_accounts():
    async with PitcheySDK() as pitchey:
        # Login with demo accounts
        await pitchey.auth.login_demo_creator()
        await pitchey.auth.login_demo_investor()
        await pitchey.auth.login_demo_production()
        
        # Get demo account info
        demo_accounts = pitchey.auth.get_demo_accounts()
        print("Available demo accounts:", demo_accounts)
```

### Registration

```python
async def register_new_user():
    async with PitcheySDK() as pitchey:
        registration = await pitchey.auth.register({
            "email": "newuser@example.com",
            "username": "newfilmmaker",
            "password": "securePassword123",
            "user_type": "creator",
            "first_name": "Jane",
            "last_name": "Smith",
            "company_name": "Smith Productions"
        })
        
        print("Registration successful:", registration["user"])
```

## Pitch Management

### Creating and Managing Pitches

```python
async def manage_pitches():
    async with PitcheySDK.demo("creator") as pitchey:
        # Create a new pitch
        pitch_data = {
            "title": "The Last Star",
            "logline": "A space exploration thriller about humanity's last chance",
            "genre": "Sci-Fi Thriller",
            "format": "feature",
            "short_synopsis": "When Earth becomes uninhabitable...",
            "target_audience": "Adults 25-54, sci-fi enthusiasts",
            "budget_range": "5M-20M",
            "seeking_investment": True,
            "visibility": "public"
        }
        
        new_pitch = await pitchey.pitches.create(pitch_data)
        pitch_id = new_pitch["pitch"]["id"]
        print(f"Created pitch: {new_pitch['pitch']['title']}")
        
        # Update the pitch
        updated_pitch = await pitchey.pitches.update(pitch_id, {
            "short_synopsis": "Updated synopsis with more details...",
            "budget_range": "10M-30M"
        })
        
        # Get pitch details
        pitch_details = await pitchey.pitches.get(pitch_id)
        print(f"Pitch views: {pitch_details['view_count']}")
        
        # Archive the pitch
        await pitchey.pitches.archive(pitch_id)
```

### Advanced Search

```python
async def search_pitches():
    async with PitcheySDK.public() as pitchey:
        # Basic search
        search_results = await pitchey.pitches.search({
            "q": "space thriller",
            "genre": "sci-fi",
            "format": "feature",
            "budget_range": "5M-20M",
            "seeking_investment": True,
            "sort": "most_viewed",
            "page": 1,
            "limit": 20
        })
        
        # Advanced search with multiple filters
        advanced_results = await pitchey.search.advanced({
            "query": "thriller",
            "genres": ["thriller", "action"],
            "budget_ranges": ["1M-5M", "5M-20M"],
            "stages": ["script", "pre-production"],
            "seeking_investment": True
        })
        
        print(f"Found {len(search_results['pitches'])} basic results")
        print(f"Found {len(advanced_results['pitches'])} advanced results")
```

## User Management

### Profile and Preferences

```python
async def manage_profile():
    async with PitcheySDK.demo("creator") as pitchey:
        # Get current profile
        profile = await pitchey.users.get_profile()
        print(f"Current user: {profile['username']}")
        
        # Update profile
        updated_profile = await pitchey.users.update_profile({
            "bio": "Independent filmmaker with 10 years of experience",
            "location": "Los Angeles, CA",
            "website": "https://myfilmcompany.com"
        })
        
        # Get and update preferences
        preferences = await pitchey.users.get_preferences()
        await pitchey.users.update_preferences({
            "email_notifications": True,
            "preferred_genres": ["action", "thriller", "sci-fi"],
            "notification_frequency": "daily"
        })
```

### Following and Networking

```python
async def networking():
    async with PitcheySDK.demo("investor") as pitchey:
        # Search for users
        creators = await pitchey.users.search("filmmaker", {"user_type": "creator"})
        
        # Follow interesting creators
        for creator in creators["data"][:5]:
            await pitchey.users.follow(creator["id"])
            print(f"Following {creator['username']}")
        
        # Get followers and following
        followers = await pitchey.users.get_followers()
        following = await pitchey.users.get_following()
        
        print(f"Followers: {followers['meta']['total']}")
        print(f"Following: {following['meta']['total']}")
```

## Investment Tracking

### Portfolio Management

```python
async def manage_investments():
    async with PitcheySDK.demo("investor") as pitchey:
        # Get investment portfolio
        portfolio = await pitchey.investments.list()
        
        print(f"Portfolio value: ${portfolio['total_value']:,.2f}")
        print(f"Total gain: ${portfolio['total_gain']:,.2f}")
        
        # Track a new investment
        new_investment = await pitchey.investments.track({
            "pitch_id": 123,
            "amount": 500000,
            "notes": "Promising sci-fi project with strong team"
        })
        
        print(f"Tracked investment: ${new_investment['investment']['amount']:,.2f}")
        
        # Analyze investment performance
        for investment in portfolio["data"]:
            roi = ((investment.get("current_value", investment["amount"]) - investment["amount"]) / investment["amount"]) * 100
            print(f"- {investment['pitch']['title']}: {roi:.1f}% ROI")
```

## NDA Management

### Document Workflows

```python
async def handle_ndas():
    async with PitcheySDK.demo("investor") as pitchey:
        # Request NDA access
        nda_request = await pitchey.ndas.request({
            "pitch_id": 123,
            "message": "I'm interested in learning more about this project"
        })
        
        print(f"NDA request submitted: {nda_request['nda']['id']}")
        
        # Get signed NDAs
        signed_ndas = await pitchey.ndas.get_signed()
        print(f"You have access to {len(signed_ndas['data'])} projects under NDA")
        
        # For pitch owners - approve/reject NDAs
        # await pitchey.ndas.approve(nda_id)
        # await pitchey.ndas.reject(nda_id, "Not suitable for current portfolio")
```

## Messaging

### Communication

```python
async def handle_messages():
    async with PitcheySDK.demo("creator") as pitchey:
        # Get conversations
        conversations = await pitchey.messages.get_conversations()
        
        # Send a message
        message = await pitchey.messages.send({
            "receiver_id": 456,
            "subject": "Interest in your project",
            "content": "Hi, I'm interested in learning more about your project...",
            "pitch_id": 123  # Optional reference
        })
        
        print(f"Message sent: {message['message_data']['id']}")
        
        # Mark messages as read
        for conv in conversations["data"]:
            if conv["unread_count"] > 0:
                await pitchey.messages.mark_as_read(conv["last_message"]["id"])
```

## Notifications

### Managing Notifications

```python
async def handle_notifications():
    async with PitcheySDK.demo("creator") as pitchey:
        # Get unread notifications
        notifications = await pitchey.notifications.list({
            "read": False,
            "limit": 20
        })
        
        print(f"You have {notifications['unread_count']} unread notifications")
        
        # Process notifications
        for notification in notifications["data"]:
            print(f"- {notification['title']}: {notification['message']}")
            
            # Mark as read
            await pitchey.notifications.mark_as_read(notification["id"])
```

## Media Uploads

### File Management

```python
async def upload_media():
    async with PitcheySDK.demo("creator") as pitchey:
        # Upload a file
        with open("movie_poster.jpg", "rb") as file:
            upload = await pitchey.media.upload({
                "file": file,
                "type": "poster",
                "pitch_id": 123
            })
        
        print(f"File uploaded: {upload['file']['url']}")
        print(f"File size: {upload['file']['size']} bytes")
```

## Analytics and Tracking

### Event Tracking

```python
async def track_analytics():
    async with PitcheySDK() as pitchey:
        # Track various events
        await pitchey.analytics.track({
            "event_type": "pitch_view",
            "pitch_id": 123,
            "event_data": {
                "duration": 180,
                "scroll_depth": 85
            }
        })
        
        await pitchey.analytics.track({
            "event_type": "search",
            "event_data": {
                "query": "sci-fi thriller",
                "results_count": 25
            }
        })
        
        print("Analytics events tracked successfully")
```

## Error Handling

The SDK provides comprehensive error handling:

```python
import asyncio
from pitchey_sdk import (
    PitcheySDK,
    PitcheyAPIError,
    PitcheyAuthenticationError,
    PitcheyNotFoundError,
    PitcheyValidationError,
    PitcheyRateLimitError
)

async def handle_errors():
    async with PitcheySDK() as pitchey:
        try:
            pitch = await pitchey.pitches.get(999999)
        except PitcheyNotFoundError:
            print("Pitch not found")
        except PitcheyAuthenticationError:
            print("Please log in")
        except PitcheyValidationError as e:
            print("Validation errors:", e.validation_errors)
        except PitcheyRateLimitError as e:
            print(f"Rate limited. Retry after {e.retry_after} seconds")
        except PitcheyAPIError as e:
            print(f"API error: {e.message} (Status: {e.status_code})")

asyncio.run(handle_errors())
```

## Data Visualization Examples

### Using Plotly for Interactive Charts

```python
import asyncio
import plotly.graph_objects as go
import plotly.express as px
from pitchey_sdk import PitcheySDK

async def create_interactive_charts():
    async with PitcheySDK.public() as pitchey:
        # Get pitch data
        pitches = await pitchey.pitches.get_public(limit=100)
        df = pd.DataFrame(pitches["data"])
        
        # Genre distribution pie chart
        genre_counts = df["genre"].value_counts()
        
        fig_pie = go.Figure(data=[go.Pie(
            labels=genre_counts.index,
            values=genre_counts.values,
            hole=0.3
        )])
        fig_pie.update_layout(title="Pitch Distribution by Genre")
        fig_pie.show()
        
        # Views vs Likes scatter plot
        fig_scatter = px.scatter(
            df, 
            x="view_count", 
            y="like_count",
            color="genre",
            hover_data=["title", "user.username"],
            title="Views vs Likes by Genre"
        )
        fig_scatter.show()

asyncio.run(create_interactive_charts())
```

### Building a Dashboard with Dash

```python
import dash
from dash import dcc, html, Input, Output
import plotly.express as px
import asyncio
from pitchey_sdk import PitcheySDK

# Get data
async def load_dashboard_data():
    async with PitcheySDK.public() as pitchey:
        pitches = await pitchey.pitches.get_public(limit=200)
        return pd.DataFrame(pitches["data"])

# Initialize Dash app
app = dash.Dash(__name__)

# Load data
df = asyncio.run(load_dashboard_data())

app.layout = html.Div([
    html.H1("Pitchey Analytics Dashboard"),
    
    dcc.Dropdown(
        id="genre-dropdown",
        options=[{"label": genre, "value": genre} for genre in df["genre"].unique()],
        value=df["genre"].unique()[0],
        multi=True
    ),
    
    dcc.Graph(id="views-chart"),
    dcc.Graph(id="budget-chart"),
])

@app.callback(
    [Output("views-chart", "figure"), Output("budget-chart", "figure")],
    [Input("genre-dropdown", "value")]
)
def update_charts(selected_genres):
    filtered_df = df[df["genre"].isin(selected_genres)]
    
    # Views chart
    views_fig = px.histogram(
        filtered_df, 
        x="view_count", 
        nbins=20,
        title="Distribution of Pitch Views"
    )
    
    # Budget chart
    budget_fig = px.bar(
        filtered_df.groupby("budget_range").size().reset_index(name="count"),
        x="budget_range",
        y="count",
        title="Pitches by Budget Range"
    )
    
    return views_fig, budget_fig

if __name__ == "__main__":
    app.run_server(debug=True)
```

## Testing

The SDK includes comprehensive test coverage:

```bash
# Install development dependencies
pip install pitchey-sdk[dev]

# Run tests
pytest

# Run tests with coverage
pytest --cov=pitchey_sdk --cov-report=html

# Run specific test categories
pytest -m "not slow"  # Skip slow tests
pytest -m "unit"      # Run only unit tests
pytest -m "integration"  # Run only integration tests
```

## Type Hints and IDE Support

The SDK is fully typed for excellent IDE support:

```python
from pitchey_sdk import PitcheySDK
from pitchey_sdk.models import Pitch, User
from typing import List

async def get_user_pitches(user_id: int) -> List[Pitch]:
    async with PitcheySDK() as pitchey:
        user: User = await pitchey.users.get(user_id)
        pitches: List[Pitch] = await pitchey.pitches.list({"user_id": user_id})
        return pitches
```

## Configuration

Customize the SDK behavior:

```python
pitchey = PitcheySDK(
    api_url="https://api.pitchey.com",  # Custom API URL
    api_key="your-api-key",            # API key
    timeout=60.0,                      # Request timeout
    retries=5,                         # Retry attempts
    debug=True,                        # Debug logging
)
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes with proper typing
4. Add tests for new functionality
5. Run the test suite: `pytest`
6. Ensure code quality: `black . && isort . && flake8`
7. Commit your changes: `git commit -am 'Add new feature'`
8. Push to the branch: `git push origin feature-name`
9. Submit a pull request

## Support

- 📖 [API Documentation](https://pitchey.com/developers)
- 🐍 [Python SDK Documentation](https://pitchey.com/developers/python-sdk)
- 💬 [Discord Community](https://discord.gg/pitchey-developers)
- 📧 Email: [developers@pitchey.com](mailto:developers@pitchey.com)
- 🐛 [Issue Tracker](https://github.com/pitchey/sdk-python/issues)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Changelog

### v1.0.0
- Initial release
- Full async/await support
- Comprehensive API coverage
- Data analysis tools integration
- Type hints and documentation
- Robust error handling