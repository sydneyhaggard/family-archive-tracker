# Dev Container for Family Archive Tracker
# Uses Node.js 20 with Firebase CLI pre-installed

FROM mcr.microsoft.com/devcontainers/javascript-node:20

# Install Firebase CLI globally
RUN npm install -g firebase-tools

# Install additional useful tools (OpenJDK 21 for Debian Trixie)
RUN apt-get update && apt-get install -y \
    openjdk-21-jre-headless \
    && rm -rf /var/lib/apt/lists/*

# Java is required for Firebase emulators
ENV JAVA_HOME=/usr/lib/jvm/java-21-openjdk-arm64
