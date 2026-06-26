# 🔋 BatteryLoop Backend

Express + MongoDB backend for the BatteryLoop battery recycling rewards system.

## Quick Start

### Prerequisites
- Node.js 18+
- MongoDB Atlas cluster (or local MongoDB)
- Google Cloud OAuth 2.0 Client ID

### 1. Install Dependencies
```bash
cd batteryloop-backend
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your credentials
```

Required environment variables:
| Variable | Description |
|---|---|
| `MONGODB_URI` | MongoDB connection string |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID |
| `JWT_SECRET` | Random secret for signing JWTs |
| `ADMIN_EMAILS` | Comma-separated admin email addresses |

### 3. Update Frontend
Open `frontend/auth.js` and replace `YOUR_GOOGLE_CLIENT_ID` with your actual Google Client ID.

### 4. Run
```bash
npm run dev
```

Open http://localhost:3000

## API Endpoints

### Auth
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/google` | No | Exchange Google credential for JWT |
| GET | `/api/auth/me` | JWT | Get current user profile |

### Deposits
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/deposit` | JWT | Create deposit, get code |
| GET | `/api/deposit/history` | JWT | User's deposit history |
| GET | `/api/deposit/code/:code` | JWT | Lookup deposit by code |

### Sensor (NodeMCU)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/sensor-data` | No | Confirm deposit from bin |
| GET | `/api/sensor-data/status/:code` | No | Check deposit status |

### Rewards
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/rewards` | No | List reward catalog |
| POST | `/api/rewards/redeem` | JWT | Redeem a reward |
| GET | `/api/rewards/my-coupons` | JWT | Get assigned coupons |

### Admin (requires admin role)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/check` | Verify admin access |
| GET | `/api/admin/users` | List all users |
| GET | `/api/admin/drops` | List verified deposits |
| GET/POST | `/api/admin/coupons` | CRUD coupons |
| PATCH/DELETE | `/api/admin/coupons/:id` | Update/delete coupon |
| GET/POST | `/api/admin/assigned` | Manage assigned coupons |
| GET | `/api/admin/bins` | Bin metrics |
| POST | `/api/admin/bins/:binId/empty` | Reset bin |
| GET | `/api/admin/sensor-events` | Sensor event log |

### Utility
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/claim-drop-code` | Claim 4-digit bin code |

## Points System
| Batteries | Points |
|-----------|--------|
| 1–2 | 10 |
| 3–5 | 25 |
| 6–10 | 60 |
| 10+ | 100 |

## Architecture
- **Express** — HTTP server & routing
- **Mongoose** — MongoDB ODM
- **JWT** — Stateless authentication
- **Google Auth Library** — Verify Google ID tokens
- **CORS** — Cross-origin support
