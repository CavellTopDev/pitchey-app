"""
Code Executor Container Server
Handles secure execution of JavaScript, Python, SQL, and other code in sandboxed environments.
Provides validation, testing, and deployment capabilities with strict security controls.
"""
import os
import sys
import asyncio
import logging
import tempfile
import shutil
import uuid
import subprocess
import json
import ast
import signal
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List, Union
from pathlib import Path
import resource
import psutil

# Add shared utilities to path
sys.path.append('/app/shared')

from fastapi import FastAPI, HTTPException, BackgroundTasks, Request, Query, Body, Form
from fastapi.responses import JSONResponse, PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import uvicorn

# Code processing imports
import sqlparse
from pygments import highlight
from pygments.lexers import get_lexer_by_name
from pygments.formatters import TerminalFormatter

from health import HealthChecker
from security import SecurityManager, require_auth, ResourceLimiter
from utils import FileManager, ProcessingQueue, setup_logging, ConfigManager

# Initialize services
setup_logging('code-executor')
logger = logging.getLogger(__name__)
config = ConfigManager('code-executor')
health_checker = HealthChecker('code-executor')
security_manager = SecurityManager()
resource_limiter = ResourceLimiter()
file_manager = FileManager()
processing_queue = ProcessingQueue(max_concurrent=config.get('max_workers', 2))

# Rate limiting
limiter = Limiter(key_func=get_remote_address)

# FastAPI app
app = FastAPI(
    title="Pitchey Code Executor",
    description="Container service for secure code execution, validation, and testing",
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

class CodeExecutor:
    """Handles secure code execution and validation."""
    
    def __init__(self):
        self.sandbox_dir = Path('/tmp/sandbox')
        self.execution_dir = Path('/tmp/execution')
        self.max_execution_time = 30  # seconds
        self.max_memory = 256 * 1024 * 1024  # 256MB
        self.max_output_size = 1024 * 1024  # 1MB
        
        self.supported_languages = {
            'python': {
                'extensions': ['.py'],
                'executor': self._execute_python,
                'validator': self._validate_python
            },
            'javascript': {
                'extensions': ['.js', '.mjs'],
                'executor': self._execute_javascript,
                'validator': self._validate_javascript
            },
            'sql': {
                'extensions': ['.sql'],
                'executor': self._execute_sql,
                'validator': self._validate_sql
            },
            'deno': {
                'extensions': ['.ts', '.js'],
                'executor': self._execute_deno,
                'validator': self._validate_typescript
            }
        }
        
        # Dangerous patterns to check for
        self.dangerous_patterns = {
            'python': [
                'import os', 'import sys', 'import subprocess', 'import socket',
                'import urllib', 'import requests', '__import__', 'eval(', 'exec(',
                'open(', 'file(', 'input(', 'raw_input('
            ],
            'javascript': [
                'require(', 'import(', 'fetch(', 'XMLHttpRequest', 'process.exit',
                'process.env', 'fs.', 'child_process', 'os.', 'cluster.'
            ],
            'sql': [
                'DROP', 'DELETE', 'UPDATE', 'INSERT', 'TRUNCATE', 'ALTER',
                'CREATE', 'GRANT', 'REVOKE', 'xp_', 'sp_'
            ]
        }
    
    async def validate_code_safety(self, code: str, language: str) -> Dict[str, Any]:
        """Check code for dangerous patterns and potential security issues."""
        issues = []
        severity = 'low'
        
        dangerous_patterns = self.dangerous_patterns.get(language, [])
        
        for pattern in dangerous_patterns:
            if pattern.lower() in code.lower():
                issues.append({
                    'pattern': pattern,
                    'message': f'Potentially dangerous pattern detected: {pattern}',
                    'severity': 'high' if pattern in ['DROP', 'DELETE', 'exec(', 'eval('] else 'medium'
                })
                if issues[-1]['severity'] == 'high':
                    severity = 'high'
                elif issues[-1]['severity'] == 'medium' and severity != 'high':
                    severity = 'medium'
        
        # Check code length
        if len(code) > 50000:  # 50KB limit
            issues.append({
                'pattern': 'code_length',
                'message': 'Code too long (>50KB)',
                'severity': 'medium'
            })
        
        # Language-specific validation
        if language in self.supported_languages:
            validator = self.supported_languages[language]['validator']
            try:
                validation_result = await validator(code)
                if validation_result.get('errors'):
                    issues.extend(validation_result['errors'])
            except Exception as e:
                issues.append({
                    'pattern': 'validation_error',
                    'message': f'Validation failed: {e}',
                    'severity': 'high'
                })
        
        return {
            'safe': len([i for i in issues if i['severity'] == 'high']) == 0,
            'issues': issues,
            'severity': severity,
            'language': language
        }
    
    async def _validate_python(self, code: str) -> Dict[str, Any]:
        """Validate Python code using AST parsing."""
        try:
            # Parse AST to check for syntax errors
            tree = ast.parse(code)
            
            # Check for dangerous AST nodes
            dangerous_nodes = []
            
            class DangerousNodeVisitor(ast.NodeVisitor):
                def visit_Import(self, node):
                    for alias in node.names:
                        if alias.name in ['os', 'sys', 'subprocess', 'socket']:
                            dangerous_nodes.append(f'Import of dangerous module: {alias.name}')
                    self.generic_visit(node)
                
                def visit_Call(self, node):
                    if isinstance(node.func, ast.Name) and node.func.id in ['eval', 'exec', 'open']:
                        dangerous_nodes.append(f'Dangerous function call: {node.func.id}')
                    self.generic_visit(node)
            
            visitor = DangerousNodeVisitor()
            visitor.visit(tree)
            
            return {
                'valid': True,
                'errors': [{'pattern': 'ast_check', 'message': msg, 'severity': 'high'} 
                          for msg in dangerous_nodes]
            }
            
        except SyntaxError as e:
            return {
                'valid': False,
                'errors': [{'pattern': 'syntax_error', 'message': str(e), 'severity': 'high'}]
            }
    
    async def _validate_javascript(self, code: str) -> Dict[str, Any]:
        """Validate JavaScript code using Node.js."""
        try:
            # Create temporary file for validation
            temp_file = self.execution_dir / f"validate_{uuid.uuid4().hex}.js"
            
            with open(temp_file, 'w') as f:
                f.write(code)
            
            # Run Node.js syntax check
            result = await asyncio.create_subprocess_exec(
                'node', '--check', str(temp_file),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await result.communicate()
            
            # Clean up
            temp_file.unlink(missing_ok=True)
            
            if result.returncode == 0:
                return {'valid': True, 'errors': []}
            else:
                return {
                    'valid': False,
                    'errors': [{'pattern': 'syntax_error', 'message': stderr.decode(), 'severity': 'high'}]
                }
            
        except Exception as e:
            return {
                'valid': False,
                'errors': [{'pattern': 'validation_error', 'message': str(e), 'severity': 'high'}]
            }
    
    async def _validate_sql(self, code: str) -> Dict[str, Any]:
        """Validate SQL code using sqlparse."""
        try:
            # Parse SQL
            parsed = sqlparse.parse(code)
            
            errors = []
            for statement in parsed:
                # Check for dangerous SQL operations
                statement_str = str(statement).upper()
                
                dangerous_ops = ['DROP', 'DELETE', 'UPDATE', 'INSERT', 'TRUNCATE', 'ALTER', 'CREATE']
                for op in dangerous_ops:
                    if op in statement_str:
                        errors.append({
                            'pattern': f'sql_{op.lower()}',
                            'message': f'Dangerous SQL operation: {op}',
                            'severity': 'high'
                        })
            
            return {'valid': True, 'errors': errors}
            
        except Exception as e:
            return {
                'valid': False,
                'errors': [{'pattern': 'sql_parse_error', 'message': str(e), 'severity': 'high'}]
            }
    
    async def _validate_typescript(self, code: str) -> Dict[str, Any]:
        """Validate TypeScript code using Deno."""
        try:
            # Create temporary file for validation
            temp_file = self.execution_dir / f"validate_{uuid.uuid4().hex}.ts"
            
            with open(temp_file, 'w') as f:
                f.write(code)
            
            # Run Deno check
            result = await asyncio.create_subprocess_exec(
                'deno', 'check', str(temp_file),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await result.communicate()
            
            # Clean up
            temp_file.unlink(missing_ok=True)
            
            if result.returncode == 0:
                return {'valid': True, 'errors': []}
            else:
                return {
                    'valid': False,
                    'errors': [{'pattern': 'type_error', 'message': stderr.decode(), 'severity': 'medium'}]
                }
            
        except Exception as e:
            return {
                'valid': False,
                'errors': [{'pattern': 'validation_error', 'message': str(e), 'severity': 'high'}]
            }
    
    async def execute_code_safely(self, code: str, language: str, 
                                 inputs: Optional[List[str]] = None) -> Dict[str, Any]:
        """Execute code in a sandboxed environment."""
        
        execution_id = uuid.uuid4().hex[:8]
        start_time = datetime.utcnow()
        
        try:
            # Validate code safety first
            safety_check = await self.validate_code_safety(code, language)
            if not safety_check['safe']:
                return {
                    'execution_id': execution_id,
                    'status': 'blocked',
                    'message': 'Code execution blocked due to safety concerns',
                    'safety_check': safety_check,
                    'executed_at': start_time.isoformat()
                }
            
            # Execute using appropriate handler
            if language in self.supported_languages:
                executor = self.supported_languages[language]['executor']
                result = await executor(code, execution_id, inputs)
                
                # Add metadata
                result.update({
                    'execution_id': execution_id,
                    'language': language,
                    'executed_at': start_time.isoformat(),
                    'execution_time': (datetime.utcnow() - start_time).total_seconds(),
                    'safety_check': safety_check
                })
                
                return result
            else:
                raise HTTPException(status_code=400, detail=f"Unsupported language: {language}")
                
        except Exception as e:
            logger.error(f"Code execution failed: {e}")
            return {
                'execution_id': execution_id,
                'status': 'error',
                'message': str(e),
                'language': language,
                'executed_at': start_time.isoformat()
            }
    
    async def _execute_python(self, code: str, execution_id: str, 
                            inputs: Optional[List[str]] = None) -> Dict[str, Any]:
        """Execute Python code in sandbox."""
        
        # Create execution file
        exec_file = self.execution_dir / f"exec_{execution_id}.py"
        
        # Wrap code with safety measures
        wrapped_code = f"""
import sys
import signal
import resource

# Set resource limits
resource.setrlimit(resource.RLIMIT_AS, ({self.max_memory}, {self.max_memory}))
resource.setrlimit(resource.RLIMIT_CPU, ({self.max_execution_time}, {self.max_execution_time}))

# Timeout handler
def timeout_handler(signum, frame):
    raise TimeoutError("Execution timeout")

signal.signal(signal.SIGALRM, timeout_handler)
signal.alarm({self.max_execution_time})

try:
    # User code
{self._indent_code(code, 4)}
except Exception as e:
    print(f"Error: {{e}}")
finally:
    signal.alarm(0)
"""
        
        with open(exec_file, 'w') as f:
            f.write(wrapped_code)
        
        try:
            # Execute in sandbox using firejail
            process = await asyncio.create_subprocess_exec(
                'firejail', '--profile=/etc/firejail/pitchey-executor.profile',
                'python3', str(exec_file),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                stdin=asyncio.subprocess.PIPE if inputs else None
            )
            
            # Provide inputs if available
            stdin_data = '\n'.join(inputs) if inputs else None
            stdout, stderr = await asyncio.wait_for(
                process.communicate(input=stdin_data.encode() if stdin_data else None),
                timeout=self.max_execution_time
            )
            
            return {
                'status': 'completed',
                'stdout': stdout.decode()[:self.max_output_size],
                'stderr': stderr.decode()[:self.max_output_size],
                'return_code': process.returncode
            }
            
        except asyncio.TimeoutError:
            if process:
                process.kill()
                await process.wait()
            return {
                'status': 'timeout',
                'message': f'Execution timed out after {self.max_execution_time} seconds'
            }
        finally:
            exec_file.unlink(missing_ok=True)
    
    async def _execute_javascript(self, code: str, execution_id: str,
                                inputs: Optional[List[str]] = None) -> Dict[str, Any]:
        """Execute JavaScript code using Node.js."""
        
        exec_file = self.execution_dir / f"exec_{execution_id}.js"
        
        # Wrap code with safety measures
        wrapped_code = f"""
const originalRequire = require;
require = function(module) {{
    const dangerous = ['fs', 'child_process', 'os', 'cluster', 'net', 'http'];
    if (dangerous.includes(module)) {{
        throw new Error(`Module ${{module}} is not allowed`);
    }}
    return originalRequire(module);
}};

setTimeout(() => {{
    process.exit(1);
}}, {self.max_execution_time * 1000});

try {{
{self._indent_code(code, 4)}
}} catch (error) {{
    console.error('Error:', error.message);
}}
"""
        
        with open(exec_file, 'w') as f:
            f.write(wrapped_code)
        
        try:
            process = await asyncio.create_subprocess_exec(
                'firejail', '--profile=/etc/firejail/pitchey-executor.profile',
                'node', str(exec_file),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=self.max_execution_time
            )
            
            return {
                'status': 'completed',
                'stdout': stdout.decode()[:self.max_output_size],
                'stderr': stderr.decode()[:self.max_output_size],
                'return_code': process.returncode
            }
            
        except asyncio.TimeoutError:
            if process:
                process.kill()
                await process.wait()
            return {
                'status': 'timeout',
                'message': f'Execution timed out after {self.max_execution_time} seconds'
            }
        finally:
            exec_file.unlink(missing_ok=True)
    
    async def _execute_deno(self, code: str, execution_id: str,
                          inputs: Optional[List[str]] = None) -> Dict[str, Any]:
        """Execute TypeScript/JavaScript code using Deno."""
        
        exec_file = self.execution_dir / f"exec_{execution_id}.ts"
        
        with open(exec_file, 'w') as f:
            f.write(code)
        
        try:
            process = await asyncio.create_subprocess_exec(
                'firejail', '--profile=/etc/firejail/pitchey-executor.profile',
                'deno', 'run', '--no-remote', '--no-npm', str(exec_file),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=self.max_execution_time
            )
            
            return {
                'status': 'completed',
                'stdout': stdout.decode()[:self.max_output_size],
                'stderr': stderr.decode()[:self.max_output_size],
                'return_code': process.returncode
            }
            
        except asyncio.TimeoutError:
            if process:
                process.kill()
                await process.wait()
            return {
                'status': 'timeout',
                'message': f'Execution timed out after {self.max_execution_time} seconds'
            }
        finally:
            exec_file.unlink(missing_ok=True)
    
    async def _execute_sql(self, code: str, execution_id: str,
                         inputs: Optional[List[str]] = None) -> Dict[str, Any]:
        """Execute SQL code (read-only operations only)."""
        
        # For now, only validate SQL - actual execution would need a database connection
        # This is a placeholder for SQL execution logic
        
        try:
            parsed = sqlparse.parse(code)
            
            formatted_sql = []
            for statement in parsed:
                formatted = sqlparse.format(statement, reindent=True, keyword_case='upper')
                formatted_sql.append(formatted)
            
            return {
                'status': 'validated',
                'message': 'SQL validation successful (execution not implemented)',
                'formatted_sql': '\n\n'.join(formatted_sql),
                'statement_count': len(parsed)
            }
            
        except Exception as e:
            return {
                'status': 'error',
                'message': f'SQL validation failed: {e}'
            }
    
    def _indent_code(self, code: str, spaces: int) -> str:
        """Indent code by specified number of spaces."""
        return '\n'.join(' ' * spaces + line for line in code.split('\n'))

# Initialize code executor
executor = CodeExecutor()

@app.on_event("startup")
async def startup_event():
    """Initialize service on startup."""
    logger.info("Code Executor starting up...")
    
    # Verify required tools are available
    required_tools = ['python3', 'node', 'deno', 'firejail']
    
    for tool in required_tools:
        try:
            result = subprocess.run([tool, '--version'], capture_output=True, text=True)
            logger.info(f"{tool} available")
        except FileNotFoundError:
            logger.warning(f"{tool} not available")
    
    health_checker.mark_ready()
    logger.info("Code Executor ready to accept requests")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown."""
    logger.info("Code Executor shutting down...")
    file_manager.cleanup()

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return health_checker.get_health_status()

@app.get("/ready")
async def readiness_check():
    """Readiness probe endpoint."""
    return health_checker.get_readiness_status()

@app.post("/execute")
@require_auth(security_manager)
@limiter.limit("20/minute")
async def execute_code(
    request: Request,
    code: str = Body(..., embed=True),
    language: str = Body(..., embed=True),
    inputs: Optional[List[str]] = Body(None, embed=True)
):
    """Execute code in a secure sandboxed environment."""
    
    if len(code) > 50000:  # 50KB limit
        raise HTTPException(status_code=400, detail="Code too long (max 50KB)")
    
    if language not in executor.supported_languages:
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported language. Supported: {list(executor.supported_languages.keys())}"
        )
    
    try:
        result = await executor.execute_code_safely(code, language, inputs)
        return result
        
    except Exception as e:
        logger.error(f"Code execution failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/validate")
@require_auth(security_manager)
@limiter.limit("60/minute")
async def validate_code(
    request: Request,
    code: str = Body(..., embed=True),
    language: str = Body(..., embed=True)
):
    """Validate code for safety and syntax without execution."""
    
    if len(code) > 50000:  # 50KB limit
        raise HTTPException(status_code=400, detail="Code too long (max 50KB)")
    
    try:
        result = await executor.validate_code_safety(code, language)
        return result
        
    except Exception as e:
        logger.error(f"Code validation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/deploy")
@require_auth(security_manager)
@limiter.limit("10/minute")
async def deploy_code(
    request: Request,
    code: str = Body(..., embed=True),
    language: str = Body(..., embed=True),
    deployment_name: str = Body(..., embed=True),
    environment: str = Body('development', embed=True)
):
    """Deploy validated code (placeholder for deployment logic)."""
    
    try:
        # Validate code first
        validation_result = await executor.validate_code_safety(code, language)
        
        if not validation_result['safe']:
            return {
                'deployment_id': None,
                'status': 'blocked',
                'message': 'Deployment blocked due to safety concerns',
                'validation': validation_result
            }
        
        # Generate deployment ID
        deployment_id = f"deploy_{uuid.uuid4().hex[:8]}"
        
        # In a real implementation, this would:
        # 1. Package the code
        # 2. Deploy to appropriate environment
        # 3. Set up monitoring
        # 4. Return deployment status
        
        return {
            'deployment_id': deployment_id,
            'status': 'deployed',
            'environment': environment,
            'deployment_name': deployment_name,
            'language': language,
            'validation': validation_result,
            'deployed_at': datetime.utcnow().isoformat(),
            'message': 'Code deployed successfully (simulated)'
        }
        
    except Exception as e:
        logger.error(f"Code deployment failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/languages")
async def list_supported_languages():
    """Get list of supported programming languages."""
    return {
        'supported_languages': list(executor.supported_languages.keys()),
        'language_info': {
            lang: {
                'extensions': info['extensions']
            }
            for lang, info in executor.supported_languages.items()
        },
        'execution_limits': {
            'max_execution_time': executor.max_execution_time,
            'max_memory': executor.max_memory,
            'max_output_size': executor.max_output_size,
            'max_code_size': 50000
        }
    }

@app.get("/security-policies")
async def get_security_policies():
    """Get current security policies and restrictions."""
    return {
        'dangerous_patterns': executor.dangerous_patterns,
        'sandbox_features': [
            'Network isolation',
            'Filesystem restrictions',
            'Resource limits (CPU, Memory)',
            'Execution timeout',
            'Process isolation',
            'Syscall filtering'
        ],
        'blocked_operations': {
            'python': ['File system access', 'Network requests', 'System commands'],
            'javascript': ['File system access', 'Network requests', 'Process control'],
            'sql': ['Write operations', 'Schema changes', 'System procedures']
        }
    }

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