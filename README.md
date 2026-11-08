# AI Judge backend (for the Roblox drawing game)

Roblox sends the drawings here, this server draws them as pictures, asks Claude (Anthropic) to
judge them, and sends scores + jokes back. If anything fails, the game uses its built-in
fallback judge, so nothing breaks.

## What you need (all have free/cheap starts)
1. **Anthropic API key**: console.anthropic.com -> sign up -> add a few dollars of credit -> API Keys -> Create key.
2. **GitHub account** and **Vercel account** (vercel.com, "Continue with GitHub", Hobby plan is free).
3. Your game in Roblox Creator Hub.

## Steps
1. Make a new GitHub repository and upload the contents of this `judge-backend` folder (not `node_modules`).
2. In Vercel: **Add New -> Project -> import that repo -> Deploy**.
3. Vercel project **Settings -> Environment Variables**, add:
   - `ANTHROPIC_API_KEY` = your key
   - `JUDGE_KEY` = a long random password you invent (e.g. 40 random letters/numbers)
   - optional `JUDGE_MODEL` = `claude-haiku-5-5` (cheaper/faster) – default is `claude-sonnet-5-5` (smarter jokes)
   Then **Deployments -> Redeploy**.
4. Your URL is `https://YOUR-PROJECT.vercel.app/api/judge`. Paste it into `JUDGE_URL` at the top of `RoundService`.
5. Roblox Creator Hub -> your experience -> **Secrets** -> add one named exactly `JUDGE_KEY` with the same password as step 3.
6. Studio: **Game Settings -> Security -> Allow HTTP Requests** = on.
7. Test in Studio with 2+ test players. Output should not show "Judge request failed".

## Notes
- Cost: roughly one request per round (up to 12 small images). Set a monthly spending limit in the Anthropic console.
- Drawings are anonymous labels (A, B, C...); player names never leave Roblox.
- The AI also flags inappropriate drawings; the game censors those and counts a strike.
- `npm run try-render` writes a test picture to check the drawing renderer.
