# Alpha Dawgs Veterinary Clinic

Alpha Dawgs is a full-stack veterinary clinic management app. It uses a **React + TypeScript** frontend, a **Spring Boot (Java 25)** REST API, and **MariaDB/MySQL** (XAMPP) for data storage.

## Quick start (easiest way to run)

### 1. Install prerequisites

- [Java 25+](https://adoptium.net/) (or another JDK 25)
- [Maven 3.8+](https://maven.apache.org/download.cgi)
- [Node.js 20+ and npm](https://nodejs.org/)
- [XAMPP](https://www.apachefriends.org/) with **MySQL** (MariaDB)

> Local development uses `localhost:3306`, database `vetclinic`, user `root`, and a blank password by default. These settings are for local XAMPP only.

### 2. Start the database

1. Open **XAMPP Control Panel**.
2. Click **Start** next to **MySQL**.
3. Make sure MySQL stays running while you use the app.

### 3. Install frontend dependencies (first time only)

Open a terminal in the project folder and run:

```bash
npm --prefix frontend install
```

### 4. Build the frontend

```bash
npm --prefix frontend run build
```

This creates the static files that Spring Boot serves.

### 5. Start the backend

```bash
mvn spring-boot:run
```

Wait until the terminal shows that Spring Boot has started (Tomcat on port `8080`).

> **If Maven uses the wrong Java version:** set `JAVA_HOME` to your JDK 25 folder before running Maven.  
> PowerShell example:  
> `$env:JAVA_HOME = 'C:\path\to\jdk-25'`  
> `$env:Path = "$env:JAVA_HOME\bin;$env:Path"`  
> Then run `mvn spring-boot:run` again in the same terminal.

### 6. Open the app

Go to [http://localhost:8080](http://localhost:8080).

- The **first account** you create (when the database has no users) becomes the **administrator**.
- After that, public registration closes and admins create staff accounts from **Account & staff**.
- To stop the app, press `Ctrl+C` in the terminal running Spring Boot.

## Optional: run from VS Code

If your local JDK/Maven paths match [\.vscode/tasks.json](.vscode/tasks.json), you can use:

1. **Terminal → Run Task… → Run Vet Clinic Full Stack (Java 25)** — builds the frontend and starts Spring Boot.
2. Open [http://localhost:8080](http://localhost:8080).

> Note: the included task uses machine-specific paths for Java/Maven. If it fails, update those paths in `.vscode/tasks.json` or use the manual commands above.

## Optional: frontend development mode (hot reload)

Use this when actively changing UI code:

1. Start **XAMPP MySQL** and the backend (`mvn spring-boot:run`).
2. In another terminal, run:

```bash
npm --prefix frontend run dev
```

3. Open [http://localhost:5173](http://localhost:5173). Vite proxies `/api` requests to Spring Boot on port `8080`.
4. Before running the packaged app again, rebuild the frontend with `npm --prefix frontend run build`.

## Troubleshooting

- **App won’t start / database errors:** make sure **MySQL is running** in XAMPP. The app expects a local MariaDB/MySQL server at `localhost:3306`.
- **Port 8080 already in use:** stop the other program using port 8080, or stop a previous Spring Boot process.
- **Login/API errors in browser:** confirm the backend terminal shows no startup errors and that you opened `http://localhost:8080` (not just the Vite dev server without the backend).
- **Check backend & database health:** open [http://localhost:8080/api/auth/me](http://localhost:8080/api/auth/me) — a JSON response means the API is reachable. In phpMyAdmin, select the `vetclinic` database and run `SELECT 1;` or `SHOW TABLES;` to verify the database.

## Figma prototype

An editable prototype of the clinic staff workflows can be generated in Figma with the local plugin in [figma-prototype/](./figma-prototype/). See [figma-prototype/README.md](./figma-prototype/README.md) for the one-time import and run steps. The prototype uses static sample data and does not connect to or modify the application or database.

## Test and build

```powershell
npm --prefix frontend test
npm --prefix frontend run build
mvn test
mvn verify
```

The frontend build output is written to `src/main/resources/static` and is intentionally ignored by Git; the source frontend remains in `frontend/`. Each build clears obsolete generated files from that output directory.

## Features

- **Overview** — active pets and owner totals, appointment counts, payment totals, upcoming visits, and in-app reminders
- **Pets** — register pets, link multiple pets to an owner, view/edit pet and owner contact details, search profiles, and archive/restore pets
- **Owners** — manage owner contact information and view linked active pets
- **Appointments** — book with slot availability checks, confirm, reschedule, and cancel
- **Medical records** — create/update a pet's diagnosis, treatment, notes, and date; search records by content
- **Medical and billing PDFs** — download individual records, a pet's complete medical history, unpaid invoices, and paid receipts
- **Payments** — create itemized bills, filter paid/unpaid history, see totals, record Cash/GCash/Card payments, and view/print receipts; marking a bill paid is a manual clinic action, not an external card/mobile-wallet transaction
- **Inventory** — maintain a product/medication catalog, reorder thresholds, stock adjustments, and catalog pricing
- **Itemized billing** — create multi-line service/product invoices; catalog items use server-owned prices and stock is deducted once when a bill is marked paid
- **Account & staff** — registration confirms the password, and password fields can be shown or hidden; administrators can create staff accounts, assign roles, activate/deactivate accounts, and issue temporary password resets that users must change at next login; five consecutive password failures temporarily lock an account
- **Audit trail** — administrators can review the latest 100 clinic API changes, including the account, route, time, and response status; request bodies and clinical details are not stored
- **Financial reports** — administrators can export paid invoices for a selected date range to CSV
- **In-app reminders** — pending/upcoming appointments and unpaid bills; no external email/SMS provider is configured

The first account registered in an empty database becomes the administrator; public registration then closes. The registration form requires a matching password confirmation. The **Forgot password?** prompt directs staff to contact a clinic administrator; there is no email-based reset. Administrators create staff accounts from **Account & staff** and share the generated one-time temporary password with each staff member, who must change it at first sign-in. Accounts are stored in the `clinic_users` database table; passwords are BCrypt-hashed. Login uses a protected server session, and clinic API routes require authentication. Staff accounts share the clinic data; only administrators can manage user roles and account activation.

Clinic data is stored in the `vetclinic` database served by XAMPP's MySQL/MariaDB service. The existing H2 files under `data/` are left untouched and are not imported. The backend creates or updates tables on startup in the default local profile and seeds three example pets only when `app.seed-demo-data` is enabled (enabled by default for local development). The production profile disables demo seeding. Startup also creates the appointment booking lock row, links legacy owner names to owner records, and upgrades legacy pet/account data without deleting it. Schema migrations V5 and V6 add the audit trail and login lockout columns.

### Production deployment security

The default configuration is for local development. For deployment, activate the `prod` Spring profile and provide database connection values as environment variables. The production profile requires explicit credentials, validates (but does not alter) the database schema, requires HTTPS, and marks session and CSRF cookies `Secure` with `SameSite=Lax`.

Use a dedicated database and least-privilege application account; do not use MySQL's `root` account. For example, an administrator can provision the database and app user in MariaDB:

```sql
CREATE DATABASE vetclinic;
CREATE USER 'vetclinic_app'@'localhost' IDENTIFIED BY 'use-a-unique-secret';
GRANT SELECT, INSERT, UPDATE, DELETE ON vetclinic.* TO 'vetclinic_app'@'localhost';
```

Set `DB_URL`, `DB_USERNAME`, and `DB_PASSWORD` to that account, and `SPRING_PROFILES_ACTIVE=prod`. The database schema must be created or migrated before starting the production profile; Hibernate will validate it and fail startup if it does not match. Apply the ordered SQL migrations in `src/main/resources/db/manual/` with a MariaDB client to add the appointment booking lock, patient/clinical details, scheduling assignments, inventory, invoice lines, audit history, and login lockout.

Appointment creation, rescheduling, and cancellation serialize through that database lock so concurrent requests cannot claim an overlapping active time slot for the same staff member or room. Appointments support staff assignment, duration, and a room/resource. The old server-rendered appointment, payment, and record pages have been retired; the React application and `/api` endpoints are the supported clinic interface.

Terminate TLS at a trusted reverse proxy, configure that proxy to remove client-supplied forwarding headers and set its own `X-Forwarded-Proto: https`, and do not expose the app directly to untrusted networks. The production profile honors forwarded headers and redirects insecure requests. Back up the MySQL/MariaDB database regularly.

### Database backups

On Windows/XAMPP, `scripts/backup-database.ps1` creates a timestamped SQL backup in the current user's `Documents\VetClinicBackups` directory. It uses `mysqldump` with a temporary credentials file restricted to the current Windows user; the file is removed after the dump. Set the database username and password in the environment first, and pass a different `mysqldump.exe` path if XAMPP is installed elsewhere:

```powershell
$env:DB_USERNAME = 'vetclinic_app'
$securePassword = Read-Host 'Database password' -AsSecureString
$env:DB_PASSWORD = [System.Net.NetworkCredential]::new('', $securePassword).Password
.\scripts\backup-database.ps1
Remove-Item Env:DB_PASSWORD
```

Schedule the script with Windows Task Scheduler for regular backups and keep copies on storage separate from the clinic computer. Treat backup files as sensitive personal and clinical data. The backup script only creates backups and never restores or overwrites a database. Test restores against a disposable database before relying on backups.

To test a restore safely, have a database administrator create an empty database whose name ends in `_restore` or `_recovery`, then run `scripts/restore-database.ps1` with a backup file and that target name. The script refuses other target-name patterns, streams the SQL into the existing target, and does not drop the target database. Review the restored data and verify the application against it before planning any production recovery. Use an account with the necessary database privileges and keep the restore isolated from clinic users.

```powershell
.\scripts/restore-database.ps1 `
  -BackupFile "$env:USERPROFILE\Documents\VetClinicBackups\vetclinic-20260101-120000.sql" `
  -TargetDatabase vetclinic_restore
```

## REST API

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/auth/csrf` | Initialize the CSRF cookie for secure form/API requests |
| `GET` | `/api/auth/me` | Check the current login session (includes role) |
| `POST` | `/api/auth/register` | Create the first administrator account when the database is empty |
| `POST` | `/api/auth/login` | Sign in |
| `POST` | `/api/auth/logout` | End the current session |
| `GET` | `/api/dashboard` | Clinic and billing totals |
| `GET` | `/api/notifications` | In-app appointment and unpaid-bill reminders |
| `GET` | `/api/audit` | Latest 100 API changes (administrator only) |
| `GET` | `/api/reports/payments.csv?from=YYYY-MM-DD&to=YYYY-MM-DD` | Export paid invoices for up to 367 inclusive days (administrator only) |
| `GET`, `POST` | `/api/pets` | List active pets or include archived pets; register a pet |
| `GET`, `PUT` | `/api/pets/{id}` | View and update a pet profile and linked owner contact details |
| `PATCH` | `/api/pets/{id}/archive` | Archive a pet profile without deleting its history |
| `PATCH` | `/api/pets/{id}/restore` | Restore an archived pet |
| `GET`, `POST` | `/api/owners` | List and create owner contact records |
| `PUT` | `/api/owners/{id}` | Update an owner contact record |
| `GET`, `POST` | `/api/appointments` | List and book appointments |
| `GET` | `/api/appointment-staff` | List active staff members available for assignment |
| `PUT` | `/api/appointments/{id}/reschedule` | Reschedule a visit |
| `PATCH` | `/api/appointments/{id}/confirm` | Confirm a visit |
| `PATCH` | `/api/appointments/{id}/cancel` | Cancel a visit |
| `GET`, `POST` | `/api/pets/{petId}/records` | List and create medical records |
| `GET` | `/api/pets/{petId}/records/{recordId}/pdf` | Download a medical record PDF |
| `GET` | `/api/pets/{petId}/records/pdf` | Download a pet's complete medical history PDF |
| `PUT` | `/api/records/{id}` | Update a medical record |
| `GET`, `POST` | `/api/payments` | List payment history and create a bill |
| `GET`, `POST` | `/api/inventory` | List inventory or add a catalog item |
| `GET`, `PUT` | `/api/inventory/{id}` | View or update an inventory item |
| `POST` | `/api/inventory/{id}/adjustment` | Record a stock quantity adjustment |
| `GET` | `/api/payments/{id}/pdf` | Download an unpaid invoice or paid receipt PDF |
| `POST` | `/api/payments/{id}/pay` | Record a clinic-side payment and mark the invoice paid (no external payment processing) |
| `GET` | `/api/payments/{id}/receipt` | Get a paid receipt |
| `PUT` | `/api/account/password` | Change the current account password |
| `GET` | `/api/staff` | List clinic accounts (administrator only) |
| `POST` | `/api/staff` | Create a staff account with a one-time temporary password (administrator only) |
| `PUT` | `/api/staff/{id}` | Change a staff role or active status (administrator only) |
| `POST` | `/api/staff/{id}/password-reset` | Generate a one-time temporary password (administrator only) |

Registration accepts an email address, display name, and password of at least 8 characters. Send the `X-CSRF-TOKEN` header with the `XSRF-TOKEN` cookie for `POST`, `PUT`, and `PATCH` requests; the frontend handles this automatically.
