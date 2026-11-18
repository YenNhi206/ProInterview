# Sign In – Class Specification

## a. Authentication Controller

Table: Authentication Controller Description Table

| No | Method | Description |
|---|---|---|
| 1 | login(req, res, next) | Receives the user's sign-in credentials (email, password) and forwards them to the service layer; returns the access token, refresh token and user information on success, or an error message on failure. |

## b. Authentication Service

Table: Authentication Service Description Table

| No | Method | Description |
|---|---|---|
| 1 | loginUser(body, req) | Validates the credentials, checks that the account is active and not locked, and verifies the password. Locks the account for 15 minutes after 5 failed attempts. |
| 2 | pushNewSession(user, req) | Creates a new login session and generates a refresh token for the user. |
| 3 | issueAccessToken(user) | Generates a JWT access token for the authenticated user. |
