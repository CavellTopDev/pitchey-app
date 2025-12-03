"""
Base HTTP client for the Pitchey SDK.
"""

import asyncio
import json
import logging
from typing import Optional, Dict, Any, Union
from urllib.parse import urljoin

import httpx
from .exceptions import (
    PitcheyAPIError,
    PitcheyAuthenticationError,
    PitcheyAuthorizationError,
    PitcheyNotFoundError,
    PitcheyValidationError,
    PitcheyRateLimitError,
)


logger = logging.getLogger(__name__)


class BaseClient:
    """
    Base HTTP client for making requests to the Pitchey API.
    
    Handles authentication, error handling, retries, and response processing.
    """
    
    def __init__(
        self,
        api_url: str,
        api_key: Optional[str] = None,
        timeout: float = 30.0,
        retries: int = 3,
        debug: bool = False,
        **kwargs
    ):
        self.api_url = api_url.rstrip("/")
        self.api_key = api_key
        self.timeout = timeout
        self.retries = retries
        self.debug = debug
        
        # Configure logging
        if debug:
            logging.basicConfig(level=logging.DEBUG)
        
        # Create HTTP client
        self._client = httpx.AsyncClient(
            timeout=timeout,
            headers=self._get_default_headers(),
            **kwargs
        )
    
    def _get_default_headers(self) -> Dict[str, str]:
        """Get default headers for requests."""
        headers = {
            "User-Agent": "Pitchey-SDK-Python/1.0.0",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        
        return headers
    
    def set_api_key(self, api_key: str) -> None:
        """Set the API key and update default headers."""
        self.api_key = api_key
        self._client.headers["Authorization"] = f"Bearer {api_key}"
    
    def get_api_key(self) -> Optional[str]:
        """Get the current API key."""
        return self.api_key
    
    def clear_api_key(self) -> None:
        """Clear the API key and remove authorization header."""
        self.api_key = None
        self._client.headers.pop("Authorization", None)
    
    async def request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Union[Dict[str, Any], httpx._content.FileContent]] = None,
        params: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
        **kwargs
    ) -> Any:
        """
        Make an HTTP request to the API.
        
        Args:
            method: HTTP method (GET, POST, PUT, DELETE, etc.)
            endpoint: API endpoint (e.g., '/api/pitches')
            data: Request body data
            params: Query parameters
            headers: Additional headers
            **kwargs: Additional arguments passed to httpx
            
        Returns:
            Response data (parsed JSON or raw response)
            
        Raises:
            PitcheyAPIError: For API-related errors
            PitcheyAuthenticationError: For authentication errors
            PitcheyAuthorizationError: For authorization errors
            PitcheyNotFoundError: For 404 errors
            PitcheyValidationError: For validation errors
            PitcheyRateLimitError: For rate limiting errors
        """
        url = urljoin(self.api_url, endpoint)
        
        # Prepare request data
        request_kwargs = kwargs.copy()
        
        if params:
            request_kwargs["params"] = self._clean_params(params)
        
        # Handle request headers
        request_headers = self._get_default_headers().copy()
        if headers:
            request_headers.update(headers)
        
        # Handle request body
        if data is not None:
            if isinstance(data, dict):
                request_kwargs["content"] = json.dumps(data)
            else:
                # For file uploads
                request_kwargs["content"] = data
                # Remove Content-Type for file uploads to let httpx set it
                request_headers.pop("Content-Type", None)
        
        request_kwargs["headers"] = request_headers
        
        if self.debug:
            logger.debug(f"Making {method} request to {url}")
            logger.debug(f"Headers: {request_headers}")
            if data and isinstance(data, dict):
                logger.debug(f"Data: {data}")
        
        # Execute request with retries
        return await self._execute_with_retries(method, url, request_kwargs)
    
    async def _execute_with_retries(
        self, method: str, url: str, request_kwargs: Dict[str, Any]
    ) -> Any:
        """Execute request with retry logic."""
        last_exception = None
        
        for attempt in range(self.retries + 1):
            try:
                response = await self._client.request(method, url, **request_kwargs)
                
                if self.debug:
                    logger.debug(f"Response status: {response.status_code}")
                    logger.debug(f"Response headers: {dict(response.headers)}")
                
                # Handle successful responses
                if response.is_success:
                    return await self._handle_success_response(response)
                
                # Handle error responses
                await self._handle_error_response(response)
                
            except (httpx.RequestError, httpx.HTTPStatusError) as e:
                last_exception = e
                
                # Don't retry on client errors
                if isinstance(e, httpx.HTTPStatusError) and 400 <= e.response.status_code < 500:
                    break
                
                # Don't retry on the last attempt
                if attempt == self.retries:
                    break
                
                # Wait before retrying (exponential backoff)
                if attempt < self.retries:
                    wait_time = (2 ** attempt) * 1.0
                    if self.debug:
                        logger.debug(f"Retrying in {wait_time}s... (attempt {attempt + 1}/{self.retries})")
                    await asyncio.sleep(wait_time)
        
        # If we get here, all retries failed
        if last_exception:
            if isinstance(last_exception, httpx.HTTPStatusError):
                await self._handle_error_response(last_exception.response)
            else:
                raise PitcheyAPIError(f"Request failed: {last_exception}")
        
        raise PitcheyAPIError("Request failed after all retries")
    
    async def _handle_success_response(self, response: httpx.Response) -> Any:
        """Handle successful response."""
        # Handle empty responses
        if response.status_code == 204 or not response.content:
            return {}
        
        # Parse JSON response
        try:
            return response.json()
        except json.JSONDecodeError:
            return response.text
    
    async def _handle_error_response(self, response: httpx.Response) -> None:
        """Handle error response and raise appropriate exception."""
        try:
            error_data = response.json()
        except json.JSONDecodeError:
            error_data = {"error": response.text or "Unknown error"}
        
        message = error_data.get("error", error_data.get("message", "Unknown error"))
        
        # Handle specific error types
        if response.status_code == 400:
            if "validation_errors" in error_data:
                raise PitcheyValidationError(message, error_data["validation_errors"])
            raise PitcheyAPIError(message, response.status_code, error_data)
        
        elif response.status_code == 401:
            raise PitcheyAuthenticationError(message)
        
        elif response.status_code == 403:
            raise PitcheyAuthorizationError(message)
        
        elif response.status_code == 404:
            raise PitcheyNotFoundError(message)
        
        elif response.status_code == 429:
            retry_after = response.headers.get("Retry-After")
            retry_after_seconds = int(retry_after) if retry_after else None
            raise PitcheyRateLimitError(message, retry_after_seconds)
        
        else:
            raise PitcheyAPIError(message, response.status_code, error_data)
    
    def _clean_params(self, params: Dict[str, Any]) -> Dict[str, str]:
        """Clean and convert parameters to strings."""
        cleaned = {}
        for key, value in params.items():
            if value is not None:
                if isinstance(value, (list, tuple)):
                    # Handle array parameters
                    for item in value:
                        if key not in cleaned:
                            cleaned[key] = []
                        cleaned[key].append(str(item))
                else:
                    cleaned[key] = str(value)
        return cleaned
    
    # HTTP method shortcuts
    async def get(self, endpoint: str, params: Optional[Dict[str, Any]] = None, **kwargs) -> Any:
        """Make a GET request."""
        return await self.request("GET", endpoint, params=params, **kwargs)
    
    async def post(self, endpoint: str, data: Optional[Dict[str, Any]] = None, **kwargs) -> Any:
        """Make a POST request."""
        return await self.request("POST", endpoint, data=data, **kwargs)
    
    async def put(self, endpoint: str, data: Optional[Dict[str, Any]] = None, **kwargs) -> Any:
        """Make a PUT request."""
        return await self.request("PUT", endpoint, data=data, **kwargs)
    
    async def patch(self, endpoint: str, data: Optional[Dict[str, Any]] = None, **kwargs) -> Any:
        """Make a PATCH request."""
        return await self.request("PATCH", endpoint, data=data, **kwargs)
    
    async def delete(self, endpoint: str, **kwargs) -> Any:
        """Make a DELETE request."""
        return await self.request("DELETE", endpoint, **kwargs)
    
    async def close(self) -> None:
        """Close the HTTP client."""
        await self._client.aclose()