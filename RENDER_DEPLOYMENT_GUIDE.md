#  Complete Render Deployment Guide for Beginners

**Repository:** https://github.com/amanydv72/Eterna 
**What we're deploying:** Node.js backend with PostgreSQL + Redis 
**Current setup:** Local Docker -> Moving to: Render Cloud

---

##  What You'll Need

-  GitHub account (you have this - amanydv72)
-  Your repo with `render.yaml` file ( DONE - just pushed!)
-  Render account (we'll create this)
-  20-30 minutes of time

---

##  STEP-BY-STEP DEPLOYMENT

### **STEP 1: Create Render Account** (2 minutes)

1. **Go to Render website**
- Open: https://render.com
   
2. **Sign up with GitHub** (easiest way)
- Click the big blue **"Get Started"** button
- Click **"Sign up with GitHub"**
- Authorize Render to access your GitHub account
- This links your GitHub repos to Render

3. **Verify email** (check your inbox)
- Render will send a verification email
- Click the link in email to verify

**Done!** You now have a Render account.

---

### **STEP 2: Deploy Using Blueprint** (5 minutes)

Your `render.yaml` file is a "Blueprint" - it tells Render exactly what to create.

1. **Navigate to Dashboard**
- After login, you'll see the Render Dashboard
- URL: https://dashboard.render.com

2. **Create New Blueprint**
- Click the big **"New +"** button (top right)
- Select **"Blueprint"** from dropdown

3. **Connect Your Repository**
- You'll see "Connect a repository"
- Click **"Connect GitHub"** (if not already connected)
- Search for: **"Eterna"** or **"amanydv72/Eterna"**
- Click **"Connect"** next to your repository

4. **Render Detects Your Blueprint**
- Render automatically finds `render.yaml` in your repo
- You'll see a preview showing:
     ```
      Services to create:
      order-execution-engine (Web Service)
      postgres (PostgreSQL Database)
      redis (Redis Instance)
     ```

5. **Review Blueprint**
- Service Name: `order-execution-engine`
- Region: `Oregon (US West)` (or choose closest to you)
- Branch: `main` 
- Plan: **Free** 

6. **Click "Apply"**
- Render will start creating all 3 services
- You'll be redirected to a Blueprint deployment page

**Done!** Render is now building your services.

---

### **STEP 3: Wait for Deployment** (10-15 minutes)

Render will now:
1.  Create PostgreSQL database (2-3 min)
2.  Create Redis instance (2-3 min)
3.  Build your Node.js app (5-8 min)
4.  Run database migrations (1 min)
5.  Start your server

**What you'll see:**

1. **Database Services Start First**
- PostgreSQL: Creating -> Available (turns green)
- Redis: Creating -> Available (turns green)

2. **Web Service Builds**
- You'll see build logs in real-time:
     ```
     ==> Building... 
     ==> Installing dependencies (npm install)
     ==> Building TypeScript (npm run build)
     ==> Running migrations
     ==> Starting server
     ```

3. **Watch for "Live" Badge**
- When build succeeds, you'll see a green **"Live"** badge
- Your service URL will appear (e.g., `https://order-execution-engine.onrender.com`)

**If build fails:**
- Don't panic! Scroll through logs to see the error
- Common issues:
- Missing environment variables (we'll check next)
- Build script errors (check package.json)
- Database connection issues (check DATABASE_URL)

**Done!** Your app is now live on the internet!

---

### **STEP 4: Get Your Deployment URL** (1 minute)

1. **Click on "order-execution-engine" service**
- In your Render dashboard, click the web service

2. **Copy the URL**
- Top of the page shows your service URL
- Format: `https://order-execution-engine-XXXX.onrender.com`
- Click the copy icon 

3. **Test Your API**
- Open a new browser tab
- Go to: `https://your-service-url.onrender.com/ws/health`
- You should see: `{"status":"healthy","timestamp":"..."}`

**Done!** Your API is accessible from anywhere!

---

### **STEP 5: Verify Everything Works** (5 minutes)

#### **5.1 Check Database Connection**

Test endpoint:
```bash
GET https://your-service-url.onrender.com/api/orders/stats
```

Expected response:
```json
{
"totalOrders": 0,
"confirmed": 0,
"failed": 0,
"pending": 0
}
```

If you see this -> Database is connected!

#### **5.2 Test Order Execution**

Using Postman or browser:
```bash
POST https://your-service-url.onrender.com/api/orders/execute
Content-Type: application/json

{
"tokenIn": "11111111111111111111111111111111",
"tokenOut": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
"amountIn": 10,
"slippage": 0.01
}
```

Expected response:
```json
{
"success": true,
"orderId": "uuid-here",
"status": "pending"
}
```

If you see this -> Queue and Redis are working!

#### **5.3 Test WebSocket**

Open browser console and run:
```javascript
const ws = new WebSocket('wss://your-service-url.onrender.com/ws/orders/test-order-id');
ws.onopen = () => console.log('Connected!');
ws.onmessage = (e) => console.log('Message:', e.data);
```

If "Connected!" appears -> WebSocket is working!

---

### **STEP 6: Update Your Documentation** (3 minutes)

Now that you have a live URL, update your README:

1. **Open README.md**

2. **Add deployment URL** at the top:
```markdown
##  Live Demo
   
**API Base URL:** https://your-service-url.onrender.com
   
**Health Check:** https://your-service-url.onrender.com/ws/health
```

3. **Update Postman Collection**
- Open `postman_collection.json`
- Update `baseUrl` variable from `localhost:3000` to your Render URL
- Or create an environment in Postman with your production URL

4. **Commit and Push**
```bash
git add README.md postman_collection.json
git commit -m "docs: add deployment URL"
git push origin main
```

**Done!** Your documentation now shows the live deployment.

---

##  RENDER DASHBOARD FEATURES

### **Viewing Logs**

1. Click on your **"order-execution-engine"** service
2. Click **"Logs"** tab
3. See real-time server logs (like `console.log` output)

**Useful for:**
- Debugging errors
- Seeing order processing
- Monitoring DEX routing decisions

### **Environment Variables**

1. Click **"Environment"** tab
2. You'll see all auto-generated variables:
- `DATABASE_URL` (from PostgreSQL service)
- `REDIS_URL` (from Redis service)
- `NODE_ENV=production`

**To add custom variables:**
- Click **"Add Environment Variable"**
- Enter Key & Value
- Click **"Save Changes"**
- Service auto-redeploys

### **Manual Redeploy**

If you need to redeploy:
1. Click **"Manual Deploy"** button
2. Select **"Deploy latest commit"**
3. Click **"Deploy"**

Or just push to GitHub - auto-deploys!

### **Viewing Database**

1. Click on **"postgres"** service (in your dashboard)
2. Click **"Connect"** tab
3. Copy connection details
4. Use a PostgreSQL client (DBeaver, pgAdmin, etc.) to view data

**Connection info:**
- Host: `dpg-xxxxx.oregon-postgres.render.com`
- Database: `order_execution_db_xxxx`
- User: `order_execution_user`
- Password: (auto-generated, shown in dashboard)

---

##  FREE TIER LIMITS

Render's free tier includes:

**Web Services:**
- 750 hours/month (enough for 1 service 24/7)
- Spins down after 15 min inactivity (first request takes ~30 sec)
- 512 MB RAM
- 0.1 CPU

**PostgreSQL:**
- 1 GB storage
- Expires after 90 days (exports available)
- Enough for thousands of orders

**Redis:**
- 25 MB storage
- No expiration
- Enough for caching

**Limitations:**
-  Service sleeps after 15 min idle (first request slow)
-  Database limited to 1 GB
-  No custom domains (can upgrade for $7/mo)

**To prevent sleep:**
- Use a service like UptimeRobot to ping your API every 10 minutes
- Or upgrade to paid plan ($7/mo for always-on)

---

##  TROUBLESHOOTING

### **Problem: Build Failed**

**Check:**
1. View build logs (click "Logs" during build)
2. Look for error message (usually near the end)

**Common fixes:**
```bash
# TypeScript build error
- Check tsconfig.json
- Run `npm run build` locally first

# Missing dependency
- Check package.json has all deps
- Run `npm install` locally

# Migration error
- Check DATABASE_URL is set
- Verify migrations in src/database/migrations/
```

### **Problem: Database Connection Error**

**Check:**
1. PostgreSQL service is "Available" (green)
2. `DATABASE_URL` environment variable exists
3. Logs show connection string (redacted)

**Fix:**
- Click "Environment" tab
- Verify `DATABASE_URL` format:
```
postgresql://user:pass@host:5432/dbname
```
- If missing, Render auto-links services from `render.yaml`

### **Problem: Redis Connection Error**

**Check:**
1. Redis service is "Available" (green)
2. `REDIS_URL` environment variable exists
3. Format: `redis://red-xxxxx.oregon-redis.render.com:6379`

**Fix:**
- Same as database - check Environment tab
- Verify Redis service is running

### **Problem: 502 Bad Gateway**

**Causes:**
- App crashed on startup
- Port mismatch

**Fix:**
1. Check logs for startup errors
2. Verify your app listens on `PORT` env variable:
```typescript
// In server.ts
const PORT = process.env.PORT || 3000;
server.listen({ port: PORT, host: '0.0.0.0' });
```
3. Render requires `host: '0.0.0.0'` (not `localhost`)

### **Problem: "Service Unavailable" (Service is Sleeping)**

**Cause:**
- Free tier spins down after 15 min inactivity

**Fix:**
- Just wait 30-60 seconds - it's waking up!
- Subsequent requests will be fast
- To prevent: Use UptimeRobot to ping every 10 min

---

##  MONITORING YOUR DEPLOYMENT

### **Check Service Health**

```bash
# Health endpoint
curl https://your-service.onrender.com/ws/health

# Response:
{
"status": "healthy",
"timestamp": "2025-11-09T..."
}
```

### **Check Order Stats**

```bash
curl https://your-service.onrender.com/api/orders/stats

# Response:
{
"totalOrders": 5,
"confirmed": 3,
"failed": 1,
"pending": 1
}
```

### **Monitor Logs**

In Render Dashboard -> Logs tab, you'll see:
```
[INFO] Server started on port 10000
[INFO] Connected to PostgreSQL
[INFO] Connected to Redis
[INFO] Queue worker started
```

---

##  NEXT STEP: RECORD VIDEO DEMO

Now that your app is live, you can record your YouTube demo!

**Demo your deployed app:**
1. Use your Render URL in Postman
2. Submit real orders to live deployment
3. Show WebSocket updates from production
4. Display DEX routing in live logs

**Recording checklist:**
-  Show architecture diagram (from docs)
-  Submit 3-5 orders to **production URL**
-  WebSocket streaming from **production**
-  Check Render logs for DEX routing
-  Show order confirmation

---

##  DEPLOYMENT CHECKLIST

- [x] GitHub repo pushed with `render.yaml`
- [ ] Render account created
- [ ] Blueprint deployed (3 services created)
- [ ] Services are "Live" (green badges)
- [ ] Health endpoint returns 200 OK
- [ ] Test order execution successful
- [ ] WebSocket connection works
- [ ] README updated with deployment URL
- [ ] Postman collection updated with prod URL
- [ ] Ready to record video demo!

---

##  SUMMARY

**What Render Does for You:**
1.  Provides PostgreSQL (replaces your local Docker postgres)
2.  Provides Redis (replaces your local Docker redis)
3.  Hosts your Node.js backend (replaces localhost:3000)
4.  Handles HTTPS/SSL automatically
5.  Gives you a public URL accessible from anywhere
6.  Auto-deploys when you push to GitHub

**Your Deployment URL Structure:**
```
Web Service:  https://order-execution-engine-xxxx.onrender.com
PostgreSQL:   postgresql://user:pass@dpg-xxxx.oregon-postgres.render.com:5432/db
Redis:        redis://red-xxxx.oregon-redis.render.com:6379
```

**After Deployment:**
- Your local Docker setup can stay for development
- Production uses Render's managed services
- Push to GitHub -> Auto-deploys to Render
- No manual server management needed!

---

**Total Time:** ~30 minutes 
**Cost:** $0 (Free tier) 
**Next:** Record video demo, submit project! 

**Questions?** Check Render docs: https://render.com/docs
