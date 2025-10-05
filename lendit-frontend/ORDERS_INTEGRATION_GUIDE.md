# Orders Integration Guide

## Overview

This document describes the integration of the orders API endpoint (`/orders`) into the BookingCalendar component, replacing the previous booking-specific endpoints.

## API Endpoint

### Orders Endpoint

- **URL**: `GET /orders`
- **Query Parameters**:
  - `role`: 'renter' or 'owner' (required)
  - `page`: Page number (default: 1)
  - `pageSize`: Items per page (default: 50)
  - `itemId`: Filter by specific item (optional)

### Example Request

```javascript
GET /orders?role=renter&page=1&pageSize=50
```

### Example Response

```json
{
  "data": [
    {
      "id": "cmgcdfj6t0001o576vjhwptkt",
      "itemId": "cmgcd6x8b0007o53hhp7can57",
      "renterId": "cmgcd6x6w0002o53hfjwenddp",
      "ownerId": "cmgcd6x6o0001o53hcfzbu0bv",
      "start": "2025-10-10T00:00:00.000Z",
      "end": "2025-10-12T00:00:00.000Z",
      "priceTotal": 10000,
      "currency": "ILS",
      "status": "PAID",
      "paymentIntentId": null,
      "depositIntentId": null,
      "paidAt": null,
      "createdAt": "2025-10-04T14:31:21.318Z",
      "updatedAt": "2025-10-04T14:31:22.428Z",
      "item": {
        "id": "cmgcd6x8b0007o53hhp7can57",
        "title": "Professional Drill Set with 50+ Bits",
        "pricePerDay": 5000,
        "initialPrice": 10000,
        "deposit": 50000,
        "photos": [
          {
            "id": "cmgcd6xbw000ro53hqomwphb5",
            "itemId": "cmgcd6x8b0007o53hhp7can57",
            "url": "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800",
            "position": 0,
            "createdAt": "2025-10-04T14:24:39.740Z"
          }
        ]
      },
      "renter": {
        "id": "cmgcd6x6w0002o53hfjwenddp",
        "username": "sarahw",
        "email": "sarah.wilson@example.com"
      },
      "owner": {
        "id": "cmgcd6x6o0001o53hcfzbu0bv",
        "username": "johndoe",
        "email": "john.doe@example.com"
      }
    }
  ],
  "page": 1,
  "pageSize": 50,
  "total": 2
}
```

## Service Functions

### 1. fetchOrders(role, params)

Fetches orders for a specific role (renter or owner).

**Parameters:**

- `role`: 'renter' or 'owner'
- `params`: Query parameters object

**Returns:** Promise<Object> - Orders data with pagination

### 2. fetchItemOrders(itemId, role, params)

Fetches orders for a specific item filtered by role.

**Parameters:**

- `itemId`: Item ID to filter by
- `role`: 'renter' or 'owner'
- `params`: Query parameters object

**Returns:** Promise<Object> - Orders data for the item

### 3. fetchBookingCalendarData(itemId, month) - Updated

Main function used by BookingCalendar component.

**Changes:**

- Now uses `fetchItemOrders` instead of `fetchItemBookings`
- Transforms order data to booking format for compatibility
- Includes debugging logs for troubleshooting

## Data Transformation

The orders data is transformed to maintain compatibility with the existing BookingCalendar component:

```javascript
const bookings = ordersResponse.data?.map((order) => ({
  id: order.id,
  startDate: order.start, // Maps from 'start' to 'startDate'
  endDate: order.end, // Maps from 'end' to 'endDate'
  status: order.status,
  renter: order.renter,
  owner: order.owner,
  item: order.item,
  priceTotal: order.priceTotal,
  currency: order.currency,
  createdAt: order.createdAt,
  updatedAt: order.updatedAt,
}));
```

## Order Status Mapping

The component now supports the following order statuses:

| Status      | Color   | Description                |
| ----------- | ------- | -------------------------- |
| PENDING     | warning | Order created but not paid |
| PAID        | success | Order paid successfully    |
| HANDED_OVER | primary | Item handed over to renter |
| RETURNED    | info    | Item returned by renter    |
| CANCELLED   | danger  | Order cancelled            |

## Component Updates

### BookingCalendar.vue

- **Status Colors**: Updated to support new order statuses
- **Customer Names**: Already supports `username` field from renter data
- **Data Structure**: Compatible with transformed order data

### Key Features

1. **Calendar Display**: Shows orders as booked dates
2. **Status Indicators**: Color-coded status badges
3. **Customer Information**: Displays renter username/name
4. **Date Ranges**: Highlights start, middle, and end dates
5. **Recent Bookings**: Lists current month's orders

## Usage Example

```javascript
// In Item.vue
import { fetchBookingCalendarData } from "../services/bookingCalendarService";

async function loadBookings() {
  try {
    const calendarData = await fetchBookingCalendarData(
      item.value.id,
      currentMonth.value
    );
    bookings.value = calendarData.bookings;
    // ... handle other data
  } catch (error) {
    console.error("Failed to load bookings:", error);
  }
}
```

## Debugging

The integration includes console logs for debugging:

```javascript
console.log("Fetching orders for item:", itemId, "month:", month);
console.log("Orders response:", ordersResponse);
console.log("Transformed bookings:", bookings);
```

## Benefits

1. **Unified Data Source**: Uses the same orders endpoint across the application
2. **Better Data Structure**: More comprehensive order information
3. **Status Tracking**: Full order lifecycle support
4. **User Information**: Access to both renter and owner details
5. **Pricing Data**: Includes total price and currency information

## Migration Notes

- **Backward Compatibility**: Existing BookingCalendar component works without changes
- **Data Transformation**: Orders are transformed to booking format
- **Status Mapping**: New statuses are mapped to appropriate colors
- **Error Handling**: Maintains existing error handling patterns

## Testing

To test the integration:

1. Navigate to an item page as the owner
2. Check the browser console for debug logs
3. Verify that orders appear in the calendar
4. Check that status colors are correct
5. Verify customer names are displayed properly

## Future Enhancements

1. **Real-time Updates**: WebSocket integration for live updates
2. **Advanced Filtering**: Filter by status, date range, etc.
3. **Export Functionality**: Export orders to CSV/PDF
4. **Bulk Actions**: Mass operations on orders
5. **Analytics**: Order statistics and insights
