# Payment Integration Guide

## 🔄 Current Setup: Mock Payment

The application currently uses a **mock payment system** for testing without requiring real payment processing.

---

## 🎯 Mock Payment Flow

### Endpoint

```
POST /orders/:id/mock-payment
```

### How It Works

1. User completes booking flow
2. Order created with `PENDING` status
3. User clicks "Complete Payment"
4. Frontend calls `POST /orders/{orderId}/mock-payment`
5. Backend automatically:
   - Updates order status to `PAID`
   - Blocks the rental dates
   - Returns updated order
6. User redirected to success page

### Frontend Implementation

**Service:** `src/services/orderService.js`

```javascript
export async function mockPayment(orderId) {
  const { data } = await http.post(`/orders/${orderId}/mock-payment`);
  return data;
}
```

**Usage in Checkout:**

```javascript
async function handlePayment() {
  const updatedOrder = await mockPayment(order.value.id);
  // Order status is now PAID
  router.push({ name: "checkout-success" });
}
```

---

## 💳 Switching to Real Stripe Payment

To enable real Stripe payment processing:

### 1. Update OrderCheckout.vue

```javascript
// Change this line:
const useMockPayment = ref(true); // ← Set to false

// To:
const useMockPayment = ref(false);
```

### 2. Add Stripe Package

Already installed: `@stripe/stripe-js` ✅

### 3. Set Environment Variable

```bash
# .env
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_actual_key_here
```

### 4. Backend Requirements

Ensure backend has:

- `POST /orders/:id/checkout-intent` endpoint
- Stripe webhook handler at `/webhooks/stripe`
- Stripe secret key configured

### 5. Complete Implementation

The Stripe integration code structure is already in place in `OrderCheckout.vue`. When `useMockPayment = false`, you would:

1. Call `/orders/:id/checkout-intent` to get `clientSecret`
2. Initialize Stripe Elements
3. Show Stripe payment form
4. Handle confirmation
5. Webhook updates order to PAID

---

## 🧪 Testing Mock Payment

### Test Flow

1. Browse to an item
2. Click "Book Now"
3. Select dates
4. Get quote
5. Proceed to checkout
6. Click "Complete Payment"
7. ✅ Order immediately marked as PAID

### Visual Indicators

- **Yellow warning banner** shows "Test Mode" message
- **Payment button** says "Complete Payment" (not credit card form)
- **Footer** shows "Simulated secure payment"

---

## 📊 Comparison

| Feature             | Mock Payment       | Real Stripe         |
| ------------------- | ------------------ | ------------------- |
| **Setup**           | None needed        | Requires API keys   |
| **Testing**         | Instant            | Test cards needed   |
| **Status Update**   | Immediate          | Via webhook         |
| **User Experience** | One-click          | Card form required  |
| **Real Charges**    | No                 | Yes (in production) |
| **Best For**        | Development & Demo | Production          |

---

## 🔐 Security Notes

### Mock Payment

- ⚠️ **Development only** - Do not use in production
- No actual payment processing
- No card validation
- Instant order confirmation

### Real Stripe

- ✅ PCI-compliant payment processing
- ✅ Secure card handling
- ✅ Real fraud prevention
- ✅ Production-ready

---

## 🚀 Deployment Checklist

Before going to production:

- [ ] Set `useMockPayment = false`
- [ ] Configure Stripe publishable key
- [ ] Configure Stripe secret key (backend)
- [ ] Set up webhook endpoint
- [ ] Test with Stripe test cards
- [ ] Verify webhook signature validation
- [ ] Test payment failures
- [ ] Test refund flow

---

## 📝 Order Status Flow

```
User Books → Order Created (PENDING)
                    ↓
           Mock Payment Called
                    ↓
           Order Status → PAID
                    ↓
          Dates Auto-Blocked
                    ↓
         Success Page Shown
```

---

## 🛠️ Toggle Configuration

Create a config file for easy switching:

**src/config/payment.js**

```javascript
export const PAYMENT_CONFIG = {
  useMock: import.meta.env.VITE_USE_MOCK_PAYMENT === "true",
  stripeKey: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY,
};
```

**.env**

```bash
VITE_USE_MOCK_PAYMENT=true
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
```

---

## ✅ Current Status

- ✅ Mock payment fully implemented
- ✅ One-click payment for testing
- ✅ Automatic status updates
- ✅ Success/failure handling
- ✅ User-friendly test mode indicators
- ⏳ Real Stripe integration (ready to enable)

---

**Perfect for development and demos! Switch to real Stripe when ready for production.** 🎉
