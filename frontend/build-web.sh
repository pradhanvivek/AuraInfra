#!/bin/bash
# Build script for Expo web export

cd /app/frontend

echo "Building Expo web app..."
npx expo export --platform web

echo "Copying built files to web server..."
sudo cp -r dist/* /var/www/html/

echo "Reloading nginx..."
sudo nginx -s reload

echo "Web build complete! Your app is now accessible via browser."
