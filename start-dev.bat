@echo off
echo Starting Pitchey Development Environment...

REM Start PostgreSQL in Docker
echo Starting PostgreSQL database...
docker-compose up -d db

REM Wait for PostgreSQL
echo Waiting for database to be ready...
timeout /t 5 /nobreak > nul

REM Start backend server in new window
echo Starting backend server...
start "Pitchey Backend" cmd /k "set JWT_SECRET=test-secret-key-for-development && set DATABASE_URL=postgresql://postgres:password@localhost:5432/pitchey && deno run --allow-all working-server.ts"

REM Start frontend in new window
echo Starting frontend...
start "Pitchey Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo Development environment started!
echo    Frontend: http://localhost:5173
echo    Backend:  http://localhost:8001
echo    Database: PostgreSQL on port 5432
echo.
echo Close this window to keep services running
echo Or press Ctrl+C to stop Docker database
pause