@echo off
cd /d "C:\Users\Orange1\.cursor\worktrees\cockpit\vmb"
set PATH=%PATH%;C:\Program Files\Git\cmd

echo [%date% %time%] Starting 15m JSON Update... >> update_15m_log.txt

:: =========================================
:: 1. Generate JSON from PostgreSQL
:: =========================================
echo  - Generating management_data.json from PostgreSQL... >> update_15m_log.txt
node scripts/generate-json-from-sql.js >> update_15m_log.txt 2>&1

:: =========================================
:: 2. Commit and Push to GitHub
:: =========================================
echo  - Committing and pushing to GitHub... >> update_15m_log.txt
git add public/data/*.json >> update_15m_log.txt 2>&1
git commit -m "Auto Update 15m: %date% %time%" >> update_15m_log.txt 2>&1
git push origin main >> update_15m_log.txt 2>&1

echo [%date% %time%] 15m JSON Update Complete. >> update_15m_log.txt
echo --------------------------------------------------- >> update_15m_log.txt
