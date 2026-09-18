# Architecture Documentation

## Overview
- Implemented create, get, update and list. The versions and audit endpoints are stubbed and return 501, ran out of time for those so I focused on the core CRUD and the data model instead
- Handlers are plain functions that return a status code and body, so the local server, the Lambda wrapper and the tests all use the same code
- Validation is done with Zod before anything hits storage
- Run locally with pnpm dev, tests with pnpm test, and pnpm synth to check the CDK

## Data Model
- Single DynamoDB table
- Each item has a "latest" record with the current state, plus a separate record for every version (partition key is the item id for both)
- Every update writes the new latest record and a new version record. Right now these are two separate puts, they should be a single transaction with a check on the previous version number so two people editing at once can't clobber each other (would return a 409)
- GSI1 is for listing by subject (and subject + status), GSI2 is for listing by status like a review queue
- Only the latest records go into the indexes so old versions never show up in list results
- Pagination uses a cursor instead of offset since DynamoDB doesn't really do offsets

## Infrastructure
- CDK in the infrastructure folder
- One Lambda per route so each has its own role and logs
- Read only routes only get read access to the table
- DynamoDB on demand billing since traffic should be low and spiky
- Dev and prod configs are in config.ts, mostly log retention, memory and log levels

## Security
- No auth on the API yet, this is the biggest gap and I didn't have time to get to it. Would add IAM auth or Cognito, and then use the user's groups to enforce the securityLevel on items since right now it's stored but not checked
- API Gateway data tracing is off so question content doesn't end up in logs

## Scalability
- Item ids spread writes out evenly
- Listing with no filter falls back to a scan which is fine for small data but shouldn't be the main path
- Saving a full copy per version uses more storage but items are small so I think its ok

## Trade-offs / TODO
- Finish the versions and audit endpoints, the version records are already being written so it's mostly just the handlers
- Audit trail should record who made the change
- More tests, the DynamoDB layer has none right now. Skipped these to stay within the time limit
- Before prod: auth, alarms, throttling, backups on the table, lock down CORS. Left these out of the CDK given the time box
