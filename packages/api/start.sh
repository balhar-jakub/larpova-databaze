#!/bin/bash
# Heroku start wrapper: adds SSL to DATABASE_URL and disables cert validation for RDS
export DATABASE_URL="${DATABASE_URL}?sslmode=require"
export NODE_TLS_REJECT_UNAUTHORIZED=0
exec npx tsx src/index.ts
