# VIBE.md — Project Testing Guidance

> Edit this file with your project's details. Vibe Test reads it automatically on every run.

## Login URL
/login

## Test Credentials
- Email: your-test-user@example.com
- Password: your-test-password

## Never Automate
- delete account
- cancel subscription
- [data-testid="danger-zone"]

## Known Flaky
- /notifications (if WebSocket dependent)

## Notes
- Add any project-specific testing notes here
- e.g. "Admin panel lives at /admin, use admin@example.com / adminpass"
