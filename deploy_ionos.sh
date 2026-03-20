#!/bin/bash

# IONOS Deployment Script for RiResume
# Using SFTP/SSH details provided by user

HOST="access-5019864019.webspace-host.com"
USER="a2016978"
REMOTE_PATH="." # Root directory
LOCAL_PATH="dist/"

echo "🚀 Starting deployment to IONOS..."
echo "Target: $USER@$HOST"

# Verify dist folder exists
if [ ! -d "$LOCAL_PATH" ]; then
    echo "❌ Error: $LOCAL_PATH directory not found. Please run 'npx expo export --platform web' first."
    exit 1
fi

# RSync command to upload dist folder contents
# -a: archive mode (preserves permissions, etc.)
# -v: verbose
# -z: compress during transfer
# --delete: delete extraneous files from dest (optional, disabled for safety)
# -e ssh: use ssh for transfer

echo "📤 Uploading files..."
rsync -avz -e ssh "$LOCAL_PATH" "$USER@$HOST:$REMOTE_PATH"

if [ $? -eq 0 ]; then
    echo "✅ Deployment successful!"
    echo "🌍 Visit: https://www.riresume.com"
else
    echo "❌ Deployment failed. Please check your connection or password."
fi
