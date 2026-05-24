#!/bin/bash
# Heroku start wrapper: adds SSL to DATABASE_URL before starting the app
export DATABASE_URL="${DATABASE_URL}?sslmode=require"
exec npx tsx src/index.ts
