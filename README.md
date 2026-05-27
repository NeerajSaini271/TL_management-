# TL Management and Attendance Tracking System

Production-grade backend for Team Lead Management with Attendance Tracking, Ratings, and Audit Logging.

## Tech Stack
- Node.js 22+, TypeScript, Fastify 5
- Neon PostgreSQL (cloud) + pg library
- Redis (optional)
- JWT httpOnly cookies + Argon2
- Zod validation, Swagger docs

## Quick Start
` 
pnpm install
cp .env.example .env
pnpm dev
` 

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/v1/auth/register | Register |
| POST | /api/v1/auth/login | Login |
| GET | /api/v1/auth/me | Get current user |
| PUT | /api/v1/auth/change-password | Change password |
| POST | /api/v1/auth/logout | Logout |

### TL Management
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/v1/tls | Admin/Manager | Create TL |
| GET | /api/v1/tls | Admin/Manager | List TLs |
| GET | /api/v1/tls/:id | Any | Get TL |
| PUT | /api/v1/tls/:id | Admin/Manager | Update TL |
| DELETE | /api/v1/tls/:id | Admin | Deactivate TL |

### Attendance
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/v1/attendance/mark | Mark attendance |
| GET | /api/v1/attendance/my | History |
| GET | /api/v1/attendance/today | Today status |

### Ratings
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/v1/ratings | TL/Manager/Admin | Create rating |
| GET | /api/v1/ratings/my | Any | My ratings |

### Audit Logs
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/v1/audit/logs | Admin/Manager | View logs |

## Test Accounts
- Admin: admin@company.com / NewPass@123!
- TL: tl@company.com / TL@123!
- Employee: employee@company.com / Employee@123!

## Security
Helmet, CORS, Rate Limiting, JWT httpOnly, Argon2id, RBAC, Zod, SQL injection prevention, Audit logging.

## Docs
http://localhost:5000/docs
