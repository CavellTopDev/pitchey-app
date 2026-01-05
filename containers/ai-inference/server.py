"""
AI Inference Container Server
Handles AI/ML inference tasks including text generation, classification, sentiment analysis,
and integration with multiple AI providers (OpenAI, Anthropic, local models).
"""
import os
import sys
import asyncio
import logging
import tempfile
import json
import uuid
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List, Union
from pathlib import Path
import time
import psutil

# Add shared utilities to path
sys.path.append('/app/shared')

from fastapi import FastAPI, HTTPException, BackgroundTasks, Request, Query, Body
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import uvicorn

# AI/ML imports
import torch
from transformers import pipeline, AutoTokenizer, AutoModelForCausalLM, AutoModelForSequenceClassification
import openai
import anthropic

from health import HealthChecker
from security import SecurityManager, require_auth, ResourceLimiter
from utils import FileManager, ProcessingQueue, setup_logging, ConfigManager

# Initialize services
setup_logging('ai-inference')
logger = logging.getLogger(__name__)
config = ConfigManager('ai-inference')
health_checker = HealthChecker('ai-inference')
security_manager = SecurityManager()
resource_limiter = ResourceLimiter()
file_manager = FileManager()
processing_queue = ProcessingQueue(max_concurrent=config.get('max_workers', 2))

# Rate limiting
limiter = Limiter(key_func=get_remote_address)

# FastAPI app
app = FastAPI(
    title="Pitchey AI Inference",
    description="Container service for AI inference, text generation, classification, and analysis",
    version="1.0.0"
)

# Add rate limiting middleware
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AIInferenceEngine:
    """Handles AI inference operations with multiple providers."""
    
    def __init__(self):
        self.models = {}
        self.pipelines = {}
        self.providers = self._init_providers()
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info(f"Using device: {self.device}")
        
    def _init_providers(self) -> Dict[str, Any]:
        """Initialize AI service providers."""
        providers = {}
        
        # OpenAI
        openai_key = os.getenv('OPENAI_API_KEY')
        if openai_key:
            openai.api_key = openai_key
            providers['openai'] = openai
            logger.info("OpenAI provider initialized")
        
        # Anthropic
        anthropic_key = os.getenv('ANTHROPIC_API_KEY')
        if anthropic_key:
            providers['anthropic'] = anthropic.Anthropic(api_key=anthropic_key)
            logger.info("Anthropic provider initialized")
            
        return providers
        
    async def load_local_model(self, model_name: str, task: str = 'text-generation') -> bool:
        """Load a local HuggingFace model."""
        try:
            if model_name in self.pipelines:
                return True
                
            logger.info(f"Loading model: {model_name} for task: {task}")
            
            # Load pipeline with specified model
            pipe = pipeline(
                task,
                model=model_name,
                device=0 if self.device == "cuda" else -1,
                torch_dtype=torch.float16 if self.device == "cuda" else torch.float32,
                trust_remote_code=True
            )
            
            self.pipelines[model_name] = pipe
            logger.info(f"Model {model_name} loaded successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to load model {model_name}: {e}")
            return False
            
    async def classify_text(self, text: str, model: str = 'cardiffnlp/twitter-roberta-base-sentiment-latest') -> Dict[str, Any]:
        """Perform text classification (sentiment analysis, etc.)."""
        try:
            # Load model if not already loaded
            if model not in self.pipelines:
                await self.load_local_model(model, 'text-classification')
            
            if model in self.pipelines:
                result = self.pipelines[model](text)
                return {
                    'text': text,
                    'model': model,
                    'classification': result,
                    'confidence': max(r['score'] for r in result) if result else 0.0
                }
            else:
                raise Exception(f"Model {model} not available")
                
        except Exception as e:
            logger.error(f"Text classification failed: {e}")
            raise HTTPException(status_code=500, detail=f"Classification failed: {e}")
            
    async def generate_text_openai(self, prompt: str, model: str = 'gpt-3.5-turbo', 
                                 max_tokens: int = 500, temperature: float = 0.7) -> Dict[str, Any]:
        """Generate text using OpenAI API."""
        try:
            if 'openai' not in self.providers:
                raise Exception("OpenAI provider not configured")
            
            response = await asyncio.to_thread(
                openai.ChatCompletion.create,
                model=model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=max_tokens,
                temperature=temperature
            )
            
            return {
                'prompt': prompt,
                'generated_text': response.choices[0].message.content,
                'model': model,
                'provider': 'openai',
                'usage': response.usage._asdict() if hasattr(response, 'usage') else None
            }
            
        except Exception as e:
            logger.error(f"OpenAI text generation failed: {e}")
            raise HTTPException(status_code=500, detail=f"Text generation failed: {e}")
            
    async def generate_text_anthropic(self, prompt: str, model: str = 'claude-3-sonnet-20240229',
                                    max_tokens: int = 500) -> Dict[str, Any]:
        """Generate text using Anthropic API."""
        try:
            if 'anthropic' not in self.providers:
                raise Exception("Anthropic provider not configured")
            
            client = self.providers['anthropic']
            response = await asyncio.to_thread(
                client.messages.create,
                model=model,
                max_tokens=max_tokens,
                messages=[{"role": "user", "content": prompt}]
            )
            
            return {
                'prompt': prompt,
                'generated_text': response.content[0].text,
                'model': model,
                'provider': 'anthropic',
                'usage': {
                    'input_tokens': response.usage.input_tokens,
                    'output_tokens': response.usage.output_tokens
                }
            }
            
        except Exception as e:
            logger.error(f"Anthropic text generation failed: {e}")
            raise HTTPException(status_code=500, detail=f"Text generation failed: {e}")
            
    async def generate_text_local(self, prompt: str, model: str = 'microsoft/DialoGPT-medium',
                                max_length: int = 500, temperature: float = 0.7) -> Dict[str, Any]:
        """Generate text using local HuggingFace model."""
        try:
            # Load model if not already loaded
            if model not in self.pipelines:
                await self.load_local_model(model, 'text-generation')
            
            if model in self.pipelines:
                result = self.pipelines[model](
                    prompt,
                    max_length=max_length,
                    temperature=temperature,
                    do_sample=True,
                    pad_token_id=50256  # GPT-2 pad token
                )
                
                generated_text = result[0]['generated_text'] if result else ""
                
                return {
                    'prompt': prompt,
                    'generated_text': generated_text,
                    'model': model,
                    'provider': 'local'
                }
            else:
                raise Exception(f"Model {model} not available")
                
        except Exception as e:
            logger.error(f"Local text generation failed: {e}")
            raise HTTPException(status_code=500, detail=f"Text generation failed: {e}")
            
    async def analyze_content(self, content: str, analysis_type: str = 'comprehensive') -> Dict[str, Any]:
        """Perform comprehensive content analysis."""
        try:
            results = {
                'content': content[:200] + '...' if len(content) > 200 else content,
                'analysis_type': analysis_type,
                'timestamp': datetime.utcnow().isoformat(),
                'metrics': {}
            }
            
            # Basic metrics
            results['metrics']['word_count'] = len(content.split())
            results['metrics']['character_count'] = len(content)
            results['metrics']['sentence_count'] = len([s for s in content.split('.') if s.strip()])
            
            # Sentiment analysis
            try:
                sentiment = await self.classify_text(content, 'cardiffnlp/twitter-roberta-base-sentiment-latest')
                results['sentiment'] = sentiment['classification']
            except Exception as e:
                logger.warning(f"Sentiment analysis failed: {e}")
                results['sentiment'] = None
            
            # Content moderation (if needed)
            if analysis_type == 'comprehensive':
                results['content_flags'] = self._check_content_flags(content)
            
            return results
            
        except Exception as e:
            logger.error(f"Content analysis failed: {e}")
            raise HTTPException(status_code=500, detail=f"Analysis failed: {e}")
            
    def _check_content_flags(self, content: str) -> Dict[str, Any]:
        """Basic content moderation flags."""
        flags = {
            'potentially_inappropriate': False,
            'contains_personal_info': False,
            'excessive_caps': False,
            'flags': []
        }
        
        # Check for excessive caps
        caps_ratio = sum(1 for c in content if c.isupper()) / len(content) if content else 0
        if caps_ratio > 0.3:
            flags['excessive_caps'] = True
            flags['flags'].append('excessive_caps')
        
        # Check for potential personal info patterns
        import re
        email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
        phone_pattern = r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b'
        
        if re.search(email_pattern, content) or re.search(phone_pattern, content):
            flags['contains_personal_info'] = True
            flags['flags'].append('personal_info_detected')
        
        return flags
        
    def get_system_stats(self) -> Dict[str, Any]:
        """Get system resource usage statistics."""
        return {
            'cpu_usage': psutil.cpu_percent(),
            'memory_usage': psutil.virtual_memory().percent,
            'gpu_available': torch.cuda.is_available(),
            'gpu_memory': torch.cuda.get_device_properties(0).total_memory if torch.cuda.is_available() else 0,
            'loaded_models': list(self.pipelines.keys()),
            'providers': list(self.providers.keys())
        }

# Initialize AI engine
ai_engine = AIInferenceEngine()

@app.on_event("startup")
async def startup_event():
    """Initialize service on startup."""
    logger.info("AI Inference service starting up...")
    
    # Pre-load small default models for faster response times
    try:
        await ai_engine.load_local_model('cardiffnlp/twitter-roberta-base-sentiment-latest', 'text-classification')
    except Exception as e:
        logger.warning(f"Failed to pre-load sentiment model: {e}")
    
    health_checker.mark_ready()
    logger.info("AI Inference service ready to accept requests")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown."""
    logger.info("AI Inference service shutting down...")
    file_manager.cleanup()

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    status = health_checker.get_health_status()
    status['system_stats'] = ai_engine.get_system_stats()
    return status

@app.get("/ready")
async def readiness_check():
    """Readiness probe endpoint."""
    return health_checker.get_readiness_status()

@app.post("/analyze")
@require_auth(security_manager)
@limiter.limit("30/minute")
async def analyze_content(
    request: Request,
    content: str = Body(..., embed=True),
    analysis_type: str = Query('comprehensive', description='Type of analysis to perform')
):
    """Analyze content for sentiment, flags, and other metrics."""
    
    if len(content) > 10000:  # Limit content length
        raise HTTPException(status_code=400, detail="Content too long (max 10,000 characters)")
    
    try:
        result = await ai_engine.analyze_content(content, analysis_type)
        return result
        
    except Exception as e:
        logger.error(f"Content analysis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate")
@require_auth(security_manager)
@limiter.limit("20/minute")
async def generate_text(
    request: Request,
    prompt: str = Body(..., embed=True),
    provider: str = Query('openai', description='AI provider to use'),
    model: Optional[str] = Query(None, description='Specific model to use'),
    max_tokens: int = Query(500, description='Maximum tokens to generate'),
    temperature: float = Query(0.7, description='Generation temperature')
):
    """Generate text using specified AI provider."""
    
    if len(prompt) > 2000:  # Limit prompt length
        raise HTTPException(status_code=400, detail="Prompt too long (max 2,000 characters)")
    
    try:
        if provider == 'openai':
            model = model or 'gpt-3.5-turbo'
            result = await ai_engine.generate_text_openai(prompt, model, max_tokens, temperature)
        elif provider == 'anthropic':
            model = model or 'claude-3-sonnet-20240229'
            result = await ai_engine.generate_text_anthropic(prompt, model, max_tokens)
        elif provider == 'local':
            model = model or 'microsoft/DialoGPT-medium'
            result = await ai_engine.generate_text_local(prompt, model, max_tokens, temperature)
        else:
            raise HTTPException(status_code=400, detail=f"Unknown provider: {provider}")
        
        return result
        
    except Exception as e:
        logger.error(f"Text generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/classify")
@require_auth(security_manager)
@limiter.limit("60/minute")
async def classify_text(
    request: Request,
    text: str = Body(..., embed=True),
    model: str = Query('cardiffnlp/twitter-roberta-base-sentiment-latest', description='Classification model to use')
):
    """Classify text (sentiment analysis, topic classification, etc.)."""
    
    if len(text) > 1000:  # Limit text length for classification
        raise HTTPException(status_code=400, detail="Text too long for classification (max 1,000 characters)")
    
    try:
        result = await ai_engine.classify_text(text, model)
        return result
        
    except Exception as e:
        logger.error(f"Text classification failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/moderate")
@require_auth(security_manager)
@limiter.limit("100/minute")
async def moderate_content(
    request: Request,
    content: str = Body(..., embed=True),
    strict: bool = Query(False, description='Use strict moderation rules')
):
    """Moderate content for inappropriate material."""
    
    try:
        # Basic content moderation
        flags = ai_engine._check_content_flags(content)
        
        # Add AI-powered moderation if available
        moderation_result = {
            'content_preview': content[:100] + '...' if len(content) > 100 else content,
            'flags': flags,
            'approved': len(flags['flags']) == 0,
            'timestamp': datetime.utcnow().isoformat()
        }
        
        # If OpenAI is available, use their moderation API
        if 'openai' in ai_engine.providers:
            try:
                openai_mod = await asyncio.to_thread(
                    openai.Moderation.create,
                    input=content
                )
                moderation_result['openai_moderation'] = openai_mod.results[0]._asdict()
                
                # Override approval based on OpenAI results
                if openai_mod.results[0].flagged:
                    moderation_result['approved'] = False
                    moderation_result['flags']['flags'].append('ai_flagged')
                    
            except Exception as e:
                logger.warning(f"OpenAI moderation failed: {e}")
        
        return moderation_result
        
    except Exception as e:
        logger.error(f"Content moderation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/models")
async def list_available_models():
    """List available AI models and providers."""
    return {
        'providers': list(ai_engine.providers.keys()),
        'loaded_models': list(ai_engine.pipelines.keys()),
        'recommended_models': {
            'sentiment_analysis': 'cardiffnlp/twitter-roberta-base-sentiment-latest',
            'text_generation': 'microsoft/DialoGPT-medium',
            'question_answering': 'deepset/roberta-base-squad2',
            'summarization': 'facebook/bart-large-cnn'
        },
        'system_info': ai_engine.get_system_stats()
    }

@app.post("/models/load")
@require_auth(security_manager)
async def load_model(
    model_name: str = Body(..., embed=True),
    task: str = Body('text-generation', embed=True)
):
    """Load a specific model for use."""
    
    try:
        success = await ai_engine.load_local_model(model_name, task)
        
        if success:
            return {
                'model': model_name,
                'task': task,
                'status': 'loaded',
                'message': f"Model {model_name} loaded successfully"
            }
        else:
            raise HTTPException(status_code=400, detail=f"Failed to load model: {model_name}")
            
    except Exception as e:
        logger.error(f"Model loading failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/stats")
@require_auth(security_manager)
async def get_system_stats():
    """Get system statistics and resource usage."""
    stats = ai_engine.get_system_stats()
    stats['queue_stats'] = processing_queue.get_queue_stats()
    return stats

if __name__ == "__main__":
    port = config.get('port', 8080)
    debug = config.get('debug', False)
    
    uvicorn.run(
        "server:app",
        host="0.0.0.0",
        port=port,
        log_level="debug" if debug else "info",
        reload=debug
    )