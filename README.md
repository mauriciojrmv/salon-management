# Salon Management System

A premium SaaS web application for beauty salon management built with Next.js 15, Firebase, and TypeScript.

## Features

### 1. Client & Session System
- Create sessions when clients arrive
- Add multiple services dynamically during session
- Assign different staff members to services
- Track session status (active, completed, cancelled)

### 2. Staff Management
- Staff profiles with skills and expertise levels
- Commission configuration (percentage or fixed)
- Daily availability tracking
- Earnings calculation per service

### 3. Service Catalog
- Predefined services with pricing and duration
- Service categorization
- Category-based filtering
- Easy service selection during session

### 4. Inventory System
- Three tracking types:
  - **Unit-based**: Bottles, sachets, pieces
  - **Measurable**: ML, grams, kilograms
  - **Service-cost**: Wax, specialized products
- Automatic material usage recording
- Low stock alerts
- Cost tracking and profitability analysis

### 5. Real-Time Session Flow
1. Create session when client arrives
2. Add services dynamically
3. Assign staff per service
4. Record material usage during service
5. Process payments (full or partial)
6. Close session and view totals

### 6. Payment Processing
- Multiple payment methods: Cash, Card, QR Code, Transfer
- Full and partial payments support
- Payment status tracking
- Automatic staff earnings calculation

### 7. Appointments & Scheduling
- Smart appointment booking
- Staff availability validation
- Status management: pending, confirmed, no-show, cancelled
- Reminder system integration ready

### 8. Analytics & Dashboard
- Real-time daily revenue metrics
- Staff performance tracking
- Service profitability analysis
- Material usage insights
- Client visit history

## Tech Stack

- **Frontend**: Next.js 15 (App Router)
- **Authentication**: Firebase Auth
- **Database**: Firestore
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: React Hooks
- **Date Handling**: date-fns
- **Icons**: Lucide React

## Project Structure

```
salon-management/
├── src/
│   ├── app/
│   │   ├── (app)/
│   │   │   ├── dashboard/
│   │   │   ├── sessions/
│   │   │   ├── appointments/
│   │   │   ├── inventory/
│   │   │   ├── staff/
│   │   │   └── reports/
│   │   └── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Card.tsx
│   │   ├── Modal.tsx
│   │   ├── Select.tsx
│   │   ├── Table.tsx
│   │   ├── Alert.tsx
│   │   └── Layout.tsx
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useAsync.ts
│   │   └── useNotification.ts
│   ├── lib/
│   │   ├── firebase/
│   │   │   ├── config.ts
│   │   │   ├── db.ts
│   │   │   └── auth.ts
│   │   ├── services/
│   │   │   ├── sessionService.ts
│   │   │   ├── appointmentService.ts
│   │   │   ├── inventoryService.ts
│   │   │   └── analyticsService.ts
│   │   └── utils/
│   │       └── helpers.ts
│   └── types/
│       ├── models.ts
│       └── api.ts
├── public/
├── .env.local.example
├── tsconfig.json
├── next.config.js
├── package.json
└── README.md
```

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Firebase account

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd salon-management
```

2. Install dependencies
```bash
npm install
```

3. Setup Firebase
- Create a Firebase project
- Update `.env.local` with your Firebase credentials
- Copy from `.env.local.example`

```bash
cp .env.local.example .env.local
```

4. Run development server
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000)

## Database Schema

### Collections

#### Users
```typescript
{
  id: string (Firebase UID)
  email: string
  firstName: string
  lastName: string
  role: 'admin' | 'staff' | 'client'
  salonId: string
  profileImage?: string
  createdAt: Date
  updatedAt: Date
}
```

#### Salons
```typescript
{
  id: string
  name: string
  email: string
  owner: string (User ID)
  settings: {
    businessHours: BusinessHours
    taxRate: number
  }
  currency: string
  timezone: string
}
```

#### Sessions
```typescript
{
  id: string
  salonId: string
  clientId: string
  date: string (YYYY-MM-DD)
  startTime: Date
  endTime?: Date
  status: 'active' | 'completed' | 'cancelled'
  services: SessionService[]
  payments: Payment[]
  materialsUsed: MaterialUsage[]
  totalAmount: number
  tax: number
}
```

#### Services
```typescript
{
  id: string
  salonId: string
  name: string
  category: ServiceCategory
  price: number
  duration: number (minutes)
  isActive: boolean
}
```

#### Products (Inventory)
```typescript
{
  id: string
  salonId: string
  name: string
  sku: string
  category: ProductCategory
  type: 'measurable' | 'unit' | 'service_cost'
  currentStock: number
  minStock: number
  maxStock: number
  cost: number
  price: number
}
```

#### Appointments
```typescript
{
  id: string
  salonId: string
  clientId: string
  serviceIds: string[]
  staffId: string
  appointmentDate: string (YYYY-MM-DD)
  startTime: string (HH:mm)
  endTime: string (HH:mm)
  status: 'pending' | 'confirmed' | 'no_show' | 'cancelled'
}
```

## Key Services

### SessionService
- `createSession()` - Start a new session
- `addServiceToSession()` - Add service to active session
- `recordMaterialUsage()` - Log material consumption
- `processPayment()` - Record payment
- `closeSession()` - Finalize session

### AppointmentService
- `createAppointment()` - Book new appointment
- `confirmAppointment()` - Confirm pending appointment
- `cancelAppointment()` - Cancel with reason
- `checkStaffAvailability()` - Validate time slots

### InventoryService
- `createProduct()` - Add new product
- `updateStock()` - Decrease stock with usage
- `restockProduct()` - Increase stock
- `getLowStockProducts()` - Get items below minimum

### AnalyticsService
- `getDailyMetrics()` - Daily revenue and performance
- `getServiceProfitability()` - Calculate profit per service
- `getStaffPerformance()` - Staff earnings and metrics

## Hooks

### useAuth
Access current user and authentication state
```typescript
const { user, userData, loading, error } = useAuth();
```

### useAsync
Fetch data with loading and error states
```typescript
const { data, loading, error, refetch } = useAsync(fetchFn, deps);
```

### useNotification
Manage notifications/toasts
```typescript
const { success, error, warning, info } = useNotification();
```

## Components

### Core UI Components
- `Button` - Variants: primary, secondary, danger, ghost
- `Input` - With label and error support
- `Select` - Dropdown selection
- `Card`, `CardHeader`, `CardBody`, `CardFooter` - Content containers
- `Modal` - Dialog with sizing options
- `Table` - Data table with columns
- `Alert` - Success/error/warning/info messages

## Utilities

### Date Helpers
- `formatDate()` - Format date to locale string
- `formatTime()` - Format time only
- `formatDateTime()` - Combined date and time
- `getDayOfWeek()` - Get day name from date

### Calculation Helpers
- `calculateCommission()` - Staff earnings
- `calculateTax()` - Calculate tax on amount
- `calculateProfit()` - Revenue minus cost
- `calculateProfitMargin()` - Percentage margin

### Array Helpers
- `groupBy()` - Group array by key
- `sumBy()` - Sum array values by key
- `averageBy()` - Calculate average by key

## Future Enhancements

- [ ] Client loyalty program
- [ ] SMS/Email reminders for appointments
- [ ] Multi-salon support with role-based access
- [ ] Advanced reporting and exports (PDF, Excel)
- [ ] Mobile app (React Native)
- [ ] Recurring appointments
- [ ] Service packages/bundles
- [ ] Gift vouchers
- [ ] Waitlist management
- [ ] Integration with payment gateways

## Performance Optimizations

- Mobile-first responsive design
- Fast interactions (<2 seconds)
- Simple, minimal UI for non-technical users
- Lazy loading for data tables
- Optimized Firebase queries with indexes
- React component memoization

## Security

- Firebase Authentication with Role-Based Access
- Firestore security rules (implement as needed)
- Environment variables for sensitive data
- XSS protection with React
- Input validation on all forms

## Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Create a pull request

## License

MIT

## Support

For issues and questions, please open an issue in the repository.
