#!/bin/bash
# Heroku release phase: add SSL to DATABASE_URL for Prisma
if [[ "$DATABASE_URL" != *"sslmode"* ]]; then
  export DATABASE_URL="${DATABASE_URL}?sslmode=require"
fi
echo "Release phase: DATABASE_URL configured with SSL"
