# my-gantt-viewer

Online Gantt Graph based on GitHub Issues

## Getting Started Locally

1. Copy `.env.example` to `.env`.

2. Modify `.env`:

   - Use the client ID and client secret from GitHub OAuth App.

     Note: The Authorization Callback URL of your GitHub OAuth App should be
     something like http://locahost:5000/github/callback.

   - Session secret can be generated by:

     ```bash
     openssl rand 32 | base64
     ```

3. Start by:

   ```bash
   npm install
   npm start
   ```