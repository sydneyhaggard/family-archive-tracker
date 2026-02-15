#!/bin/bash
# Helper script to start Firebase Emulators with correct Java 21 and Node v22 environment

# Set PATH to include specific Java and Node versions installed via Homebrew and NVM
export PATH="/Users/sydneyhaggard/.nvm/versions/node/v22.21.1/bin:/opt/homebrew/opt/openjdk@21/bin:$PATH"

# Start emulators using npx to ensure firebase-tools is available
echo "Starting Firebase Emulators with Java 21 and Node v22..."
npx -y firebase-tools emulators:start
