@echo off
echo 🚀 Setting up Finance Tracker...

REM Install backend dependencies
echo 📦 Installing backend dependencies...
call npm install

REM Install frontend dependencies
echo 📦 Installing frontend dependencies...
cd frontend
call npm install
cd ..

echo ✅ Installation complete!
echo.
echo 📋 Next steps:
echo 1. Create your .env files (see README.md for details)
echo 2. Set up your PostgreSQL database
echo 3. Run 'npm run prisma:migrate' to set up the database
echo 4. Start the backend: 'npm run dev'
echo 5. Start the frontend: 'cd frontend && npm start'
echo.
echo 🌟 Your Finance Tracker will be available at:
echo    Backend:  http://localhost:3000
echo    Frontend: http://localhost:3001

pause
