# Project Structure Summary

## Complete File Structure

### Root Configuration Files
```
salon/
├── package.json                 # Project dependencies and scripts
├── package-lock.json            # Locked dependency versions
├── tsconfig.json                # TypeScript configuration
├── next.config.js               # Next.js configuration
├── tailwind.config.ts           # Tailwind CSS configuration
├── postcss.config.js            # PostCSS configuration (for Tailwind)
├── next-env.d.ts                # Next.js TypeScript environment
├── .npmrc                       # NPM configuration (legacy peer deps)
├── .gitignore                   # Git ignore rules
├── .env.local                   # Environment variables (not committed)
├── .env.local.example           # Environment variables template
├── CLAUDE.md                    # Claude AI project rules
├── PROJECT_GUIDE.md             # Architecture decisions, known issues, UX patterns
├── PROJECT_STRUCTURE.md         # This file
├── README.md                    # Project overview
├── SETUP.md                     # Setup guide
└── DEPLOYMENT.md                # Deployment guide
```

### Source Code Structure

#### Application Entry & Layouts
```
src/app/
├── page.tsx                    # Home/redirect page
├── layout.tsx                  # Root layout with metadata
├── globals.css                 # Global styles (Tailwind imports)
└── auth/
    └── page.tsx                # Login page (no self-registration)
```

#### App Routes (Protected)
```
src/app/(app)/
├── layout.tsx                  # App layout: sidebar navigation, RoleGuard, role-based nav filtering
├── dashboard/
│   └── page.tsx               # KPI cards, daily trabajos table, metrics
├── sessions/
│   └── page.tsx               # Trabajo workflow: create, add services, materials, payment, close
├── appointments/
│   └── page.tsx               # Appointment booking, quick client creation
├── clients/
│   └── page.tsx               # Client CRUD (phone-based identification)
├── services/
│   └── page.tsx               # Service catalog CRUD with Spanish category labels
├── staff/
│   └── page.tsx               # Staff CRUD with specialty + multi-service assignment
├── inventory/
│   └── page.tsx               # Product CRUD, stock tracking, low-stock alerts
├── reports/
│   └── page.tsx               # Analytics: service profitability, staff performance
└── users/
    └── page.tsx               # Admin-only: create admin/manager/staff users
```

### Components
```
src/components/
├── index.ts                    # Barrel exports
├── Button.tsx                  # Variants: primary, secondary, danger, ghost. Sizes: sm, md, lg. CSS spinner loading
├── Input.tsx                   # Form input with label, error, required indicator
├── Select.tsx                  # Native select dropdown with label
├── SearchableSelect.tsx        # Custom searchable dropdown with secondary text, click-outside close
├── Card.tsx                    # Card, CardHeader, CardBody, CardFooter
├── Modal.tsx                   # Responsive modal: slides up on mobile, centered on desktop. Sizes: sm, md, lg
├── Table.tsx                   # Generic data table with custom column renderers
├── Alert.tsx                   # Alert variants: success, error, warning, info
├── RoleGuard.tsx               # Route protection based on user role
└── Layout.tsx                  # Main layout wrapper (legacy, sidebar is in app layout)
```

### Custom Hooks
```
src/hooks/
├── index.ts                    # Barrel exports
├── useAuth.ts                  # Firebase auth state: user, userData, loading, error
├── useAsync.ts                 # Data fetching: data, loading, error, refetch
└── useNotification.ts          # Toast notifications: success, error, warning, info
```

### Firebase Integration
```
src/lib/firebase/
├── config.ts                   # Firebase init (HMR-safe), primary + secondary app, auth, db, storage exports
├── db.ts                       # Generic Firestore CRUD: addDocument, getDocument, updateDocument, deleteDocument, queryDocuments
└── auth.ts                     # loginUser, logoutUser, createUserWithoutSignIn (secondary app), createUserDocument
```

### Data Repositories
```
src/lib/repositories/
├── clientRepository.ts         # Client CRUD, getSalonClients (client-side sort, no orderBy)
├── serviceRepository.ts        # Service CRUD, getSalonServices (client-side sort, no orderBy)
├── staffRepository.ts          # Staff CRUD with specialty + serviceIds, getSalonStaff
└── productRepository.ts        # Product CRUD, getSalonProducts, getLowStockProducts, updateStock
```

### Business Logic Services
```
src/lib/services/
├── index.ts                    # Barrel exports
├── sessionService.ts           # createSession, addServiceToSession (with materials), processPayment, closeSession, getSalonDailySessions
├── appointmentService.ts       # createAppointment, updateStatus, cancel, confirm, checkAvailability, getClientAppointments
├── inventoryService.ts         # Product operations, stock management, usage tracking, inventory value calculation
├── analyticsService.ts         # getDailyMetrics, getMonthlyMetrics, getServiceProfitability, getStaffPerformance
└── commissionService.ts        # Commission calculation and reporting
```

### Auth & Roles
```
src/lib/auth/
└── roles.ts                    # UserRole type, ROLE_PERMISSIONS matrix, hasPermission(), canAccessRoute()
```

### Utilities
```
src/lib/utils/
└── helpers.ts                  # Date formatting, currency, validation, calculations, groupBy/sumBy
```

### Type Definitions
```
src/types/
├── models.ts                   # All entity types: Salon, User, Staff, Client, Service, Session, Appointment, Product, Payment, etc.
└── api.ts                      # Request/response types: CreateClientRequest, AddServiceToSessionRequest (with materials), etc.
```

### Configuration
```
src/config/
└── text.es.ts                  # ALL Spanish UI strings centralized. Sections: app, auth, nav, dashboard, sessions, appointments, services, staff, inventory, reports, clients, actions, messages, users, roles, status, material, payments
```

---

## File Statistics

- **Total src/ files**: 46
- **React Components**: 10 (+ 1 index)
- **Pages**: 10 (+ 2 layouts + 1 home)
- **Services**: 5 (+ 1 index)
- **Repositories**: 4
- **Hooks**: 3 (+ 1 index)
- **Firebase files**: 3
- **Type files**: 2
- **Config files**: 1

---

## Database Collections (Firestore)

All scoped by `salonId` for multi-tenant isolation.

1. **users** - User profiles (admin, manager, staff) + client records (role: 'client')
2. **salons** - Salon information and settings
3. **sessions** - Client sessions/trabajos (services[], payments[], materialsUsed[])
4. **services** - Service catalog (name, category, price, duration)
5. **products** - Inventory products (type: unit/measurable/service_cost, stock tracking)
6. **appointments** - Appointment bookings (date, time, status)

---

## Pages Overview

| Page | Route | Purpose |
|------|-------|---------|
| Home | `/` | Redirect to dashboard or auth |
| Auth | `/auth` | Login only (no self-registration) |
| Dashboard | `/dashboard` | Daily metrics, KPI cards, trabajos table |
| Trabajos | `/sessions` | Full work session workflow |
| Appointments | `/appointments` | Booking & scheduling |
| Clients | `/clients` | Client database with CRUD |
| Services | `/services` | Service catalog with CRUD |
| Staff | `/staff` | Staff management with specialty and services |
| Inventory | `/inventory` | Product tracking with low-stock alerts |
| Reports | `/reports` | Analytics & profitability |
| Users | `/users` | Admin-only user creation |

---

## Component Library

| Component | Variants | Use Case |
|-----------|----------|----------|
| Button | primary, secondary, danger, ghost; sm, md, lg | Actions, CSS spinner on loading |
| Input | text, email, password, number, date, tel | Form inputs with labels |
| Select | single select | Native dropdown options |
| SearchableSelect | — | Custom searchable dropdown with secondary text |
| Card | Card, CardHeader, CardBody, CardFooter | Content containers |
| Modal | sm, md, lg | Responsive dialogs (bottom-sheet on mobile) |
| Table | generic with custom column renderers | Data display |
| Alert | success, error, warning, info | Notifications |
| RoleGuard | — | Route protection by user role |

---

*Last updated: 2026-03-26*
