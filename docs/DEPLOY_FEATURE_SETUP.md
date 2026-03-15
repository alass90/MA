# Quick Setup Guide: Website Deploy Feature

## ⚡ 5-Minute Setup

### Step 1: Get API Tokens

#### Vercel Token (Required for permanent deployments)
1. Visit: https://vercel.com/account/tokens
2. Click **"Create Token"**
3. Name: `Talos Deploy`
4. Click **"Create"**
5. **Copy the token** → You'll add this to `.env`

#### Supabase Service Token (Required for fullstack deployments)
1. Visit: https://supabase.com/dashboard/account/tokens
2. Click **"Generate new token"**
3. Name: `Talos Fullstack`
4. Click **"Generate token"**
5. **Copy the token** → You'll add this to `.env`

#### GitHub Token (Optional - for future features)
1. Visit: https://github.com/settings/tokens
2. Click **"Generate new token (classic)"**
3. Name: `Talos Deploy`
4. Check scopes: `repo`, `workflow`
5. Click **"Generate token"**
6. **Copy the token** → You'll add this to `.env`

---

### Step 2: Add Tokens to Environment

Open `backend/.env` and add at the bottom:

```bash
##### DEPLOYMENT FEATURE
VERCEL_TOKEN=vercel_xxxxxxxxxxxxxxxxxxxxxxxxx
SUPABASE_SERVICE_TOKEN=sbp_xxxxxxxxxxxxxxxxxxxxxxxx
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxx  # Optional
```

**Save the file.**

---

### Step 3: Restart Backend

```bash
# Stop backend (Ctrl+C)
# Start again
cd backend
python -m uvicorn api:app --reload
```

---

### Step 4: Test It! 🎉

1. Open Talos AI in your browser
2. Create a new chat
3. Send message:
   ```
   Create a simple landing page and preview it
   ```

4. Wait for the agent to:
   - ✅ Create files
   - ✅ Call deploy_app tool
   - ✅ Preview panel opens automatically!

5. Click **"Publish"** button to deploy to Vercel

---

## ✅ Verification Checklist

- [ ] I created a Vercel token
- [ ] I created a Supabase service token
- [ ] I added tokens to `backend/.env`
- [ ] I restarted the backend server
- [ ] I tested with "create a landing page"
- [ ] Preview panel opened automatically
- [ ] I can see the website in the iframe

---

## 🐛 Troubleshooting

### "VERCEL_TOKEN not configured"
→ Check that you added the token to `backend/.env`
→ Make sure there are no spaces: `VERCEL_TOKEN=vercel_abc123`
→ Restart backend server

### Preview panel doesn't open
→ Check browser console for errors (F12)
→ Refresh the page and try again
→ Check that frontend is running (`npm run dev`)

### Deploy to Vercel fails
→ Verify your Vercel token is valid
→ Check Vercel account has deployment quota
→ Check backend logs for error details

---

## 📖 Full Documentation

See: `docs/features/website-preview-deploy.md`

---

**Need Help?**
- Check logs: `backend/logs/` or browser console
- Read full docs: `docs/features/website-preview-deploy.md`
- Create issue: GitHub Issues
