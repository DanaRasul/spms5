# SPMS — Smart Parking Management System

## Complete Setup & Production Deployment Guide

---

## 📋 Table of Contents
1. [Prerequisites](#prerequisites)
2. [Quick Start (Development)](#quick-start-development)
3. [Method A — Prisma Migrations (Recommended)](#method-a--prisma-migrations-recommended)
4. [Method B — SQL Import via phpMyAdmin](#method-b--sql-import-via-phpmyadmin)
5. [How to Login (Step-by-Step)](#how-to-login-step-by-step)
6. [Demo Accounts](#demo-accounts)
7. [API Security & Authorization](#api-security--authorization)
8. [Production Deployment Guide](#production-deployment-guide)
9. [Troubleshooting Login Issues](#troubleshooting-login-issues)
10. [Database Schema (ERD)](#database-schema-erd)
11. [Environment Variables Reference](#environment-variables-reference)

---

## Prerequisites

Before you start, make sure you have:

- **MySQL 8.0+** installed and running
- **Node.js 18+** installed
- **npm** installed
- A MySQL user with `CREATE DATABASE` privileges

---

## Quick Start (Development)

```bash
# 1. Clone / download the project
git clone <your-repo-url>
cd spms

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env and fill in DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL

# 4. Generate Prisma client
npx prisma generate

# 5. Run database migrations
npx prisma migrate deploy

# 6. Seed the database with demo data
npx prisma db seed

# 7. Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with the credentials below.

---

## Method A — Prisma Migrations (Recommended)

This is the best method for developers. It creates the database automatically.

### Step 1 — Create the MySQL Database

Open MySQL (via terminal, phpMyAdmin, or MySQL Workbench) and run:

```sql
CREATE DATABASE spms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### Step 2 — Set the DATABASE_URL

Open the `.env` file in the project root and set:

```env
DATABASE_URL="mysql://YOUR_USERNAME:YOUR_PASSWORD@localhost:3306/spms"
NEXTAUTH_SECRET="any-long-random-string-here"
NEXTAUTH_URL="http://localhost:3000"
```

### Step 3 — Run Migrations and Seed

```bash
npm install
npx prisma generate
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

---

## Method B — SQL Import via phpMyAdmin

### Step 1 — Create the Database

In phpMyAdmin, click **New** → name it `spms` → Collation: `utf8mb4_unicode_ci` → **Create**.

### Step 2 — Import the SQL File

1. Select the `spms` database
2. Click the **Import** tab
3. Choose `spms.sql` from the project root
4. Click **Go**

### Step 3 — Configure .env and Start

```bash
npm install
npx prisma generate
npm run dev
```

> **Note:** When using SQL import, skip `prisma migrate deploy` and `prisma db seed` — the SQL file already includes schema and seed data.

---

## How to Login (Step-by-Step)

1. Make sure MySQL is running and your `.env` has the correct `DATABASE_URL`
2. Run: `npx prisma generate` → `npx prisma migrate deploy` → `npx prisma db seed`
3. Start the app: `npm run dev`
4. Open [http://localhost:3000](http://localhost:3000)
5. Enter a username and password from the table below
6. Click **Sign In**

---

## Demo Accounts

> These accounts are for **development only**. Change all passwords before going to production.

| Role | Username | Password |
|------|----------|----------|
| System Admin | `sysadmin` | `admin123` |
| Branch Admin (Main) | `branch1admin` | `branch1` |
| Branch Admin (North) | `branch2admin` | `branch2` |
| Operator (Main) | `operator1` | `op123` |
| Operator (North) | `operator2` | `op123` |

---

## API Security & Authorization

All API routes are protected. Every request must be authenticated via a valid NextAuth session cookie.

### Role Permissions Matrix

| Endpoint | system_admin | branch_admin | user_admin (operator) |
|---|---|---|---|
| `GET /api/dashboard` | ✅ All branches | ✅ Own branch only | ✅ Own branch only |
| `GET /api/vehicles` | ✅ All | ✅ Own branch | ✅ Own branch |
| `POST /api/vehicles` | ✅ | ✅ Own branch | ✅ Own branch |
| `PUT /api/vehicles/[id]` | ✅ | ✅ Own branch | ✅ Own branch |
| `GET /api/spaces` | ✅ All | ✅ Own branch | ✅ Own branch |
| `POST /api/spaces` | ✅ | ✅ Own branch | ❌ |
| `PUT/DELETE /api/spaces/[id]` | ✅ | ✅ Own branch | ❌ |
| `GET /api/subscribers` | ✅ All | ✅ Own branch | ✅ Own branch |
| `POST /api/subscribers` | ✅ | ✅ Own branch | ✅ Own branch |
| `PUT/DELETE /api/subscribers/[id]` | ✅ | ✅ Own branch | ✅ Own branch |
| `GET /api/locations` | ✅ | ✅ | ✅ |
| `POST /api/locations` | ✅ | ❌ | ❌ |
| `PUT/DELETE /api/locations/[id]` | ✅ | ❌ | ❌ |
| `GET /api/users` | ✅ | ❌ | ❌ |
| `POST /api/users` | ✅ | ❌ | ❌ |
| `PUT/DELETE /api/users/[id]` | ✅ | ❌ | ❌ |
| `GET /api/settings` | ✅ | ✅ | ✅ |
| `PUT /api/settings` | ✅ | ❌ | ❌ |
| `GET /api/activity-logs` | ✅ All | ✅ Own branch | ✅ Own branch |
| `POST /api/activity-logs` | ✅ | ✅ | ✅ |

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| `200` | Success |
| `201` | Resource created |
| `400` | Validation error (missing/invalid field) |
| `401` | Not authenticated (no session) |
| `403` | Forbidden (wrong role or wrong branch) |
| `404` | Resource not found |
| `409` | Conflict (duplicate, occupied space, etc.) |
| `500` | Internal server error |

All error responses follow this JSON shape:
```json
{ "error": "Error Type", "message": "Human-readable description." }
```

---

## Production Deployment Guide

### Option 1 — VPS / DigitalOcean / AWS EC2

#### 1. Server Setup

```bash
# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install MySQL 8
sudo apt install mysql-server -y
sudo mysql_secure_installation

# Install PM2 (process manager)
npm install -g pm2
```

#### 2. MySQL Setup on Server

```sql
CREATE DATABASE spms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'spms_user'@'localhost' IDENTIFIED BY 'STRONG_PASSWORD_HERE';
GRANT ALL PRIVILEGES ON spms.* TO 'spms_user'@'localhost';
FLUSH PRIVILEGES;
```

#### 3. Deploy the Application

```bash
# Clone your repository
git clone <your-repo-url> /var/www/spms
cd /var/www/spms

# Install dependencies
npm install

# Create production .env
cp .env.example .env
nano .env
# Set:
#   DATABASE_URL="mysql://spms_user:STRONG_PASSWORD_HERE@localhost:3306/spms"
#   NEXTAUTH_SECRET="<run: openssl rand -base64 64>"
#   NEXTAUTH_URL="https://your-domain.com"
#   NODE_ENV="production"

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Seed initial data
npx prisma db seed

# Build the Next.js app
npm run build

# Start with PM2
pm2 start npm --name "spms" -- start
pm2 save
pm2 startup
```

#### 4. Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable HTTPS with Certbot:
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d your-domain.com
```

---

### Option 2 — Hostinger / cPanel Shared Hosting

> Shared hosting requires Node.js support. Check that your plan supports Node.js 18+.

1. Create a MySQL database and user in cPanel → **MySQL Databases**
2. Upload project files via FTP or Git
3. Create `.env` with your cPanel database credentials
4. In cPanel → **Node.js App**, set:
   - Node.js version: 18+
   - Application root: your project folder
   - Application startup file: `server.js` (or use the npm start script)
5. Run via SSH:
   ```bash
   npm install
   npx prisma generate
   npx prisma migrate deploy
   npx prisma db seed
   npm run build
   npm start
   ```

---

### Option 3 — Docker

```dockerfile
# Dockerfile (place in project root)
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npx prisma generate
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  db:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: rootpassword
      MYSQL_DATABASE: spms
      MYSQL_USER: spms_user
      MYSQL_PASSWORD: spms_password
    volumes:
      - mysql_data:/var/lib/mysql
    ports:
      - "3306:3306"

  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: mysql://spms_user:spms_password@db:3306/spms
      NEXTAUTH_SECRET: your-secret-here
      NEXTAUTH_URL: http://localhost:3000
      NODE_ENV: production
    depends_on:
      - db
    command: >
      sh -c "npx prisma migrate deploy && npx prisma db seed && npm start"

volumes:
  mysql_data:
```

```bash
docker-compose up -d
```

---

### Production Security Checklist

- [ ] `NEXTAUTH_SECRET` is a random string of at least 64 characters
- [ ] `NODE_ENV=production` is set
- [ ] Database password is strong and unique
- [ ] Demo user passwords have been changed
- [ ] `.env` file is NOT committed to version control
- [ ] HTTPS is enabled (SSL certificate installed)
- [ ] MySQL is not exposed to the public internet (bind to `127.0.0.1`)
- [ ] Regular database backups are configured
- [ ] Firewall allows only ports 80, 443, and 22

---

## Troubleshooting Login Issues

### "Invalid username or password"

1. Confirm the database is running: `mysql -u root -p`
2. Confirm the `spms` database exists: `SHOW DATABASES;`
3. Confirm users exist: `SELECT username, role FROM spms.User;`
4. If the `User` table is empty, run: `npx prisma db seed`
5. If passwords are wrong, re-run the seed: `npx prisma db seed` (it re-hashes all passwords)

### "Account locked"

After 5 consecutive failed attempts, the account is locked for 5 minutes. Wait 5 minutes and try again.

### Prisma migration errors

```bash
# Reset and re-apply all migrations (development only — destroys data)
npx prisma migrate reset

# Or just re-deploy without reset (safe for production)
npx prisma migrate deploy
```

### Seed script fails

```bash
# Regenerate Prisma client first
npx prisma generate
npx prisma db seed
```

---

## Database Schema (ERD)

```
User ──────────────────────────────────────────────────────────────────────────
  id (PK)  username  fullName  email  password(bcrypt)  role  branchId(FK→Location)  enabled

ParkingLocation ───────────────────────────────────────────────────────────────
  id (PK)  name  address  phoneNumber  capacity  status

ParkingSpace ──────────────────────────────────────────────────────────────────
  id (PK)  spaceNumber  locationId(FK→Location)  status
  UNIQUE(spaceNumber, locationId)

VehicleRecord ─────────────────────────────────────────────────────────────────
  id (PK)  plateNumber  parkingSpaceId(FK→Space)  locationId(FK→Location)
  entryDate  entryTime  exitDate  exitTime  duration  fee  status  editHistory(JSON)

MonthlySubscriber ─────────────────────────────────────────────────────────────
  id (PK)  plateNumber  driverName  phoneNumber  vehicleType  vehicleColor
  startDate  subscriptionPeriod  expirationDate  remainingDays
  paymentAmount  paymentStatus  locationId(FK→Location)

SystemSettings ────────────────────────────────────────────────────────────────
  id='default'  totalCapacity  hourlyRate1  hourlyRate2  hourlyRate3
  currency  timezone  parkingName  address  phoneNumber

ActivityLog ───────────────────────────────────────────────────────────────────
  id (PK)  userId  username  userRole  action  category
  oldValue  newValue  locationId  ipAddress  timestamp

FailedLogin ───────────────────────────────────────────────────────────────────
  id (PK)  userId(FK→User)  attemptedAt
```

---

## Environment Variables Reference

Copy this block into a `.env` file at the project root and fill in your values.

```env
# =============================================================================
# DATABASE (Required)
# =============================================================================
# MySQL connection string
# Format: mysql://USER:PASSWORD@HOST:PORT/DATABASE
# Local:       mysql://root:@localhost:3306/spms
# Remote VPS:  mysql://spms_user:strongpassword@db.example.com:3306/spms
# Hostinger:   mysql://u123456789_spms:password@localhost:3306/u123456789_spms
DATABASE_URL="mysql://root:@localhost:3306/spms"

# =============================================================================
# NEXTAUTH (Required)
# =============================================================================
# Full public URL of your application (no trailing slash)
# Development:  http://localhost:3000
# Production:   https://your-domain.com
NEXTAUTH_URL="http://localhost:3000"

# Random secret for signing JWT tokens
# Generate: openssl rand -base64 32
NEXTAUTH_SECRET="replace-with-a-long-random-secret-string"

# =============================================================================
# NODE ENVIRONMENT (Optional)
# =============================================================================
# Set to "production" on live server — suppresses debug logs,
# enables safe error handling (no stack traces in API responses)
NODE_ENV="production"

# =============================================================================
# LOGGING (Optional)
# =============================================================================
# Log level: debug | info | warn | error  (default: info)
LOG_LEVEL="info"
```

See `.env.example` for the full template with comments.