# Sai Art Gallery App

Next.js application for Sai Art Gallery, a local-first handmade jewellery business management system.

## Prerequisites

- Node.js 20 or newer
- PostgreSQL 15 or newer
- A local PostgreSQL user that can create databases

## First Local Start

```powershell
cd H:\BMC\Project\0.SAG\sai-art-gallery-app
npm.cmd install
Copy-Item .env.example .env -ErrorAction SilentlyContinue
npm.cmd run prisma:generate

# Create sai_art_gallery_dev in PostgreSQL before continuing.
npm.cmd run prisma:migrate -- --name init

# Set the initial Owner password only for this seed process.
$env:DEFAULT_OWNER_PASSWORD = Read-Host "Enter initial Owner password (12+ characters)"
npm.cmd run prisma:seed
Remove-Item Env:DEFAULT_OWNER_PASSWORD

npm.cmd run dev
```

The local app runs at `http://localhost:3000`.

The initial working module is **Product Inventory**. It supports categories, automatic
`SAG-XXX-0001` SKUs, products, opening stock, permanent stock movement records,
low-stock indicators, and archive-only product removal.

Sign in with `owner@saiartgallery.local` and the password entered during the seed
command. Authentication uses an HTTP-only signed local session. Business routes
verify both the session and the current database role. Only Owner accounts can open
Backup and Restore, and Staff accounts cannot see that navigation item.

## Environment

Update `DATABASE_URL` in `.env` for the PostgreSQL username and password installed
on this computer. Development must use `sai_art_gallery_dev`; do not point local
development at `sai_art_gallery`.

Replace `AUTH_SECRET` with a different random value on every computer. It must be
at least 32 characters. Changing it signs out all current sessions.

```text
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/sai_art_gallery_dev?schema=public"
```

Run `npm.cmd run prisma:generate` if a clean install does not generate the
Prisma Client automatically.

## Online Deployment

The online deployment uses Vercel for the Next.js application and Supabase
Postgres for shared data. Keep the local development database separate.

Required Vercel environment variables:

```text
DATABASE_URL=<Supabase transaction pooler URL on port 6543>
DIRECT_URL=<Supabase session pooler URL on port 5432>
AUTH_SECRET=<unique random value with at least 32 characters>
APP_NAME=Sai Art Gallery
NODE_ENV=production
```

Apply committed migrations to Supabase before deploying:

```powershell
npm.cmd run prisma:deploy
```

Vercel storage is ephemeral. Uploads, invoices, reports, exports, and backups
must use persistent object storage before those online modules are enabled.

## Important Paths

Operational files are stored outside the app source under `H:\BMC\Project\0.SAG`.

Use `.env.example` as the template for local paths and database settings.

## Security

Do not commit `.env`, uploads, invoices, reports, exports, logs, or database backups.
