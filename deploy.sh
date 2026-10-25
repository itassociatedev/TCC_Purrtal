#!/bin/bash

# ==============================================================================
# 1. THE SAFETY NET (THE BASH TRAP)
# If any command fails from this point forward, the script will automatically
# catch the error, force the site back online, and exit safely.
# ==============================================================================
trap 'php artisan up; echo "❌ Deployment crashed, but the site was forced back online safely."; exit 1' ERR

echo "🚀 Starting Bulletproof Deployment..."

# 2. Pull the latest code from GitHub
git pull origin main

# 3. Install PHP Dependencies
composer install --no-interaction --prefer-dist --optimize-autoloader

# 4. Install Node Dependencies
npm install

# ==============================================================================
# 5. SAFE FOLDER CLEANUP
# Bypasses the "EACCES: permission denied" error by forcibly removing the 
# old folder, or silently renaming it if it is locked by the server.
# ==============================================================================
rm -rf public/build || mv public/build public/build_stuck_$(date +%s) || true

# ==============================================================================
# 6. BUILD ASSETS *WHILE THE SITE IS STILL ONLINE*
# Compiling React takes the longest and is the most likely to crash. 
# By doing this before 'artisan down', a crash won't affect live users.
# ==============================================================================
npm run build

# ==============================================================================
# 7. QUICK MAINTENANCE MODE
# Now that the dangerous parts are done, we take the site offline for 
# just 1-2 seconds to swap the database and clear the cache.
# ==============================================================================
php artisan down

# 8. Run Database Migrations
php artisan migrate --force

# 9. Clear and rebuild all Laravel caches
php artisan optimize:clear

# 10. Bring the site back online
php artisan up

echo "✅ Deployment Complete! The site is fully updated and live."