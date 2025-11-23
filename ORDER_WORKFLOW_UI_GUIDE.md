# Order Workflow UI Guide

This guide explains the complete UI implementation for the rental order workflow.

---

## 🎯 Complete User Journey

### For Renters (Customers)

1. **Browse Items** → Search/Home page
2. **View Item** → Item details page
3. **Book Item** → Click "Book Now" button
4. **Select Dates** → BookingFlow modal opens
5. **Get Quote** → See detailed pricing breakdown
6. **Checkout** → Navigate to checkout page
7. **Create Order** → Order created with PENDING status
8. **Pay** → Stripe payment form
9. **Confirmation** → Order status → PAID
10. **Wait for Handover** → Owner confirms handover → HANDED_OVER
11. **Use Item** → Rental period
12. **Return Item** → Owner confirms return → RETURNED
13. **Leave Review** → Rate the experience

### For Owners

1. **Manage Availability** → Availability calendar on item page
2. **Receive Booking** → Order appears in "Items I'm Renting Out"
3. **Confirm Payment** → See PAID status
4. **Hand Over Item** → Click "Confirm Handover" → HANDED_OVER
5. **Wait for Return** → Rental period
6. **Confirm Return** → Click "Confirm Return" → RETURNED
7. **Receive Payment** → Deposit returned to renter

---

## 📁 New Components

### 1. `BookingFlow.vue`

**Location:** `src/components/BookingFlow.vue`

**Purpose:** Step-by-step booking interface

**Features:**

- Step 1: Date selection with availability checking
- Step 2: Quote review with detailed pricing breakdown
- Real-time availability validation
- Pricing preview (daily rate, initial fee, service fee, deposit)
- Smooth navigation between steps

**Usage:**

```vue
<BookingFlow :item="item" @close="closeModal" />
```

**Props:**

- `item` (Object, required) - Item object with pricing details

**Events:**

- `@close` - Emitted when user cancels or completes booking

---

### 2. `OrdersList.vue`

**Location:** `src/components/OrdersList.vue`

**Purpose:** Display and manage user's orders

**Features:**

- Filterable by status (All, Pending, Paid, Active, Completed)
- Shows both renter and owner views
- Quick status badges with icons
- Click to view order details
- Status counts in filter buttons

**Usage:**

```vue
<OrdersList role="renter" />
<OrdersList role="owner" />
```

**Props:**

- `role` (String) - Either 'renter' or 'owner'

**Status Colors:**

- 🟡 PENDING - Yellow/Warning
- 🔵 PAID - Blue/Info
- 🟣 HANDED_OVER - Purple/Primary
- 🟢 RETURNED - Green/Success
- 🔴 CANCELLED - Red/Danger

---

### 3. `OrderDetailsModal.vue`

**Location:** `src/components/OrderDetailsModal.vue`

**Purpose:** View and update order details

**Features:**

- Complete order information
- Item details with image
- Rental period
- Participants (owner & renter)
- Pricing breakdown
- Timeline
- Status management buttons

**Usage:**

```vue
<OrderDetailsModal
  :order="selectedOrder"
  @close="closeModal"
  @updated="refreshOrders"
/>
```

**Actions Available:**

- **Owner can:**

  - Confirm Handover (PAID → HANDED_OVER)
  - Confirm Return (HANDED_OVER → RETURNED)
  - Cancel (PENDING/PAID → CANCELLED)

- **Renter can:**
  - Cancel (PENDING/PAID → CANCELLED)

---

### 4. `OrderCheckout.vue`

**Location:** `src/views/OrderCheckout.vue`

**Purpose:** Complete payment for orders

**Features:**

- Step 1: Review order details
- Step 2: Stripe payment form
- Automatic order creation
- Payment intent integration
- Price summary sidebar

**Route:** `/checkout?itemId=xxx&from=2025-10-15&to=2025-10-18`

**Flow:**

1. Load item & quote
2. Create order (PENDING status)
3. Initialize Stripe payment
4. Complete payment
5. Webhook updates status to PAID
6. Redirect to success page

---

### 5. `AvailabilityCalendar.vue` (Enhanced)

**Location:** `src/components/AvailabilityCalendar.vue`

**Purpose:** Manage item availability (Owner only)

**Features:**

- Visual calendar with color coding
- Block/Unblock date ranges
- Shows booked dates (from orders)
- Shows manually blocked dates
- Multi-date selection
- Legend for status types

**Color Coding:**

- 🔴 **Red** - Blocked by owner
- 🟡 **Yellow** - Booked by order
- 🟢 **Green** - Available
- 🔵 **Blue** - Selected

---

## 🛣️ Routes

### New Routes Added

```javascript
{
  path: '/checkout',
  name: 'checkout',
  component: OrderCheckout,
  meta: { requiresAuth: true }
}
```

### Updated Routes

```javascript
{
  path: '/my/bookings',
  name: 'my-bookings',
  component: MyBookings, // Now shows orders with tabs
  meta: { requiresAuth: true }
}
```

---

## 🔄 Complete Workflow

### Scenario: User Rents a Camera

```
1. User visits /item/camera123
   └─> Sees item details, pricing, availability

2. User clicks "Book Now"
   └─> BookingFlow modal opens

3. User selects dates (Oct 15-18)
   └─> System checks availability via API
   └─> Shows 3 days rental

4. User clicks "Get Price Quote"
   └─> API: POST /items/camera123/quote
   └─> Shows:
       - 3 nights × 20 ILS = 60 ILS
       - Initial fee: 120 ILS
       - Service fee: 0 ILS
       - Total: 180 ILS
       - Deposit: 80 ILS (refundable)

5. User clicks "Proceed to Checkout"
   └─> Navigate to /checkout?itemId=camera123&from=2025-10-15&to=2025-10-18

6. Checkout Page
   └─> Shows order review
   └─> User clicks "Proceed to Payment"
   └─> API: POST /orders
       {
         "itemId": "camera123",
         "from": "2025-10-15",
         "to": "2025-10-18"
       }
   └─> Order created: status=PENDING

7. Payment Step
   └─> API: POST /orders/order789/checkout-intent
   └─> Stripe payment form loads
   └─> User enters card details
   └─> Stripe processes payment
   └─> Webhook: Order status → PAID
   └─> Dates automatically blocked

8. Owner View
   └─> Goes to /my/bookings
   └─> Switches to "Items I'm Renting Out" tab
   └─> Sees order with PAID status
   └─> Clicks order → Details modal opens
   └─> Clicks "Confirm Handover"
   └─> API: PATCH /orders/order789/status {"status": "HANDED_OVER"}

9. Rental Period
   └─> Renter uses camera for 3 days

10. Owner confirms return
    └─> Clicks "Confirm Return"
    └─> API: PATCH /orders/order789/status {"status": "RETURNED"}
    └─> Deposit refunded to renter

11. Both can leave reviews
```

---

## 💰 Pricing Calculation

All prices are in **agorot** (ILS cents). Display conversion: `amount / 100`

### Example Calculation:

```javascript
Item:
  pricePerDay: 2000 agorot (20 ILS)
  initialPrice: 12000 agorot (120 ILS)
  deposit: 8000 agorot (80 ILS)

Rental: 3 days

Calculation:
  Daily cost = 3 × 2000 = 6000 agorot
  Initial fee = 12000 agorot
  Service fee = (6000 + 12000) × 0.08 = 1440 agorot

  Rental Total = 6000 + 12000 + 1440 = 19440 agorot (194.40 ILS)

  Amount Charged = 19440 + 8000 = 27440 agorot (274.40 ILS)

  After Return:
    - Owner receives: 19440 agorot
    - Renter gets back: 8000 agorot (deposit)
```

---

## 🎨 UI Components Summary

| Component                | Purpose                | Key Features             |
| ------------------------ | ---------------------- | ------------------------ |
| **BookingFlow**          | Date selection & quote | Step-by-step, validation |
| **OrdersList**           | Order management       | Filters, status badges   |
| **OrderDetailsModal**    | View/update order      | Status actions, timeline |
| **OrderCheckout**        | Payment processing     | Stripe integration       |
| **AvailabilityCalendar** | Manage availability    | Block/unblock dates      |

---

## 📦 Dependencies Installed

```bash
npm install @stripe/stripe-js
```

---

## 🔧 Environment Variables Needed

Add to `.env`:

```bash
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
```

---

## ✅ Features Implemented

- ✅ Complete booking flow with date selection
- ✅ Real-time availability checking
- ✅ Detailed price quotes
- ✅ Order creation
- ✅ Stripe payment integration
- ✅ Order status management
- ✅ Owner/Renter separate views
- ✅ Status filtering
- ✅ Availability calendar with booking status
- ✅ Responsive design
- ✅ Modal-based workflows
- ✅ Timeline visualization
- ✅ Pricing breakdown display

---

## 🚀 Next Steps

1. **Backend Integration:**

   - Ensure all API endpoints are implemented
   - Set up Stripe webhook handler
   - Configure Stripe keys

2. **Testing:**

   - Test complete booking flow
   - Verify payment processing
   - Test status transitions
   - Check permissions (owner vs renter)

3. **Enhancements:**
   - Add email notifications
   - Implement reviews system
   - Add calendar sync
   - Export order history

---

## 📖 Quick Reference

### Order Status Flow

```
PENDING ──payment──> PAID ──handover──> HANDED_OVER ──return──> RETURNED
   │                   │           │
   └───────cancel──────┴───────────┘
           (CANCELLED)
```

### Color Scheme

- **Primary (Blue)**: Main actions, active state
- **Success (Green)**: Completed orders
- **Warning (Yellow)**: Pending, booked dates
- **Danger (Red)**: Cancelled, blocked dates
- **Info (Cyan)**: Paid status

---

All UI components are now ready and integrated! 🎉
