# Backend Endpoints for Booking Calendar

This document outlines the required backend endpoints to support the Booking Calendar feature for item owners.

## Overview

The Booking Calendar allows item owners to view all bookings and taken dates for their items. It provides a visual calendar interface with booking statistics and detailed booking information.

## Required Endpoints

### 1. Get Item Bookings by Month

**Endpoint:** `GET /api/items/:itemId/bookings`

**Description:** Retrieve all bookings for a specific item within a given month.

**Query Parameters:**

- `month` (required): Month in YYYY-MM format (e.g., "2024-01")
- `page` (optional): Page number for pagination (default: 1)
- `limit` (optional): Number of bookings per page (default: 50)

**Response Format:**

```json
{
  "success": true,
  "data": {
    "bookings": [
      {
        "id": "booking_123",
        "itemId": "item_456",
        "renterId": "user_789",
        "startDate": "2024-01-15",
        "endDate": "2024-01-17",
        "status": "CONFIRMED",
        "totalAmount": 15000,
        "currency": "ILS",
        "createdAt": "2024-01-10T10:30:00Z",
        "updatedAt": "2024-01-10T10:30:00Z",
        "renter": {
          "id": "user_789",
          "username": "johndoe",
          "firstName": "John",
          "lastName": "Doe",
          "email": "john@example.com",
          "avatar": "https://example.com/avatar.jpg"
        },
        "item": {
          "id": "item_456",
          "title": "Professional Camera",
          "pricePerDay": 5000
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 25,
      "totalPages": 1
    },
    "statistics": {
      "totalBookings": 25,
      "totalDaysBooked": 45,
      "currentMonthBookings": 8,
      "totalRevenue": 125000
    }
  }
}
```

**Status Codes:**

- `200`: Success
- `400`: Invalid month format or itemId
- `401`: Unauthorized (user not authenticated)
- `403`: Forbidden (user is not the owner of the item)
- `404`: Item not found
- `500`: Internal server error

### 2. Get Booking Details

**Endpoint:** `GET /api/bookings/:bookingId`

**Description:** Retrieve detailed information about a specific booking.

**Response Format:**

```json
{
  "success": true,
  "data": {
    "id": "booking_123",
    "itemId": "item_456",
    "renterId": "user_789",
    "startDate": "2024-01-15",
    "endDate": "2024-01-17",
    "status": "CONFIRMED",
    "totalAmount": 15000,
    "currency": "ILS",
    "paymentStatus": "PAID",
    "createdAt": "2024-01-10T10:30:00Z",
    "updatedAt": "2024-01-10T10:30:00Z",
    "renter": {
      "id": "user_789",
      "username": "johndoe",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "phone": "+1234567890",
      "avatar": "https://example.com/avatar.jpg"
    },
    "item": {
      "id": "item_456",
      "title": "Professional Camera",
      "pricePerDay": 5000,
      "initialPrice": 2000,
      "deposit": 3000
    },
    "breakdown": {
      "rentalDays": 3,
      "dailyRate": 5000,
      "subtotal": 15000,
      "initialPrice": 2000,
      "serviceFee": 1200,
      "total": 18200,
      "deposit": 3000
    }
  }
}
```

### 3. Get Item Booking Statistics

**Endpoint:** `GET /api/items/:itemId/bookings/statistics`

**Description:** Retrieve comprehensive booking statistics for an item.

**Query Parameters:**

- `period` (optional): Time period for statistics ("month", "quarter", "year") - default: "month"
- `startDate` (optional): Start date for custom period (YYYY-MM-DD)
- `endDate` (optional): End date for custom period (YYYY-MM-DD)

**Response Format:**

```json
{
  "success": true,
  "data": {
    "period": "month",
    "startDate": "2024-01-01",
    "endDate": "2024-01-31",
    "statistics": {
      "totalBookings": 25,
      "totalDaysBooked": 45,
      "totalRevenue": 125000,
      "averageBookingValue": 5000,
      "averageBookingDuration": 1.8,
      "occupancyRate": 0.75,
      "cancellationRate": 0.05
    },
    "monthlyBreakdown": [
      {
        "month": "2024-01",
        "bookings": 8,
        "revenue": 40000,
        "daysBooked": 15
      },
      {
        "month": "2024-02",
        "bookings": 12,
        "revenue": 60000,
        "daysBooked": 20
      }
    ],
    "statusBreakdown": {
      "PENDING": 2,
      "CONFIRMED": 20,
      "CANCELLED": 1,
      "COMPLETED": 2
    }
  }
}
```

## Database Schema Requirements

### Bookings Table

```sql
CREATE TABLE bookings (
  id VARCHAR(36) PRIMARY KEY,
  item_id VARCHAR(36) NOT NULL,
  renter_id VARCHAR(36) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status ENUM('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'IN_PROGRESS') NOT NULL,
  total_amount INT NOT NULL, -- Amount in cents
  currency VARCHAR(3) NOT NULL DEFAULT 'ILS',
  payment_status ENUM('PENDING', 'PAID', 'FAILED', 'REFUNDED') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
  FOREIGN KEY (renter_id) REFERENCES users(id) ON DELETE CASCADE,

  INDEX idx_item_date (item_id, start_date, end_date),
  INDEX idx_renter (renter_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
);
```

### Booking Items Table (for detailed breakdown)

```sql
CREATE TABLE booking_items (
  id VARCHAR(36) PRIMARY KEY,
  booking_id VARCHAR(36) NOT NULL,
  item_id VARCHAR(36) NOT NULL,
  daily_rate INT NOT NULL, -- Amount in cents
  initial_price INT DEFAULT 0, -- Amount in cents
  service_fee INT DEFAULT 0, -- Amount in cents
  deposit INT DEFAULT 0, -- Amount in cents
  quantity INT DEFAULT 1,

  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
);
```

## Implementation Notes

### 1. Authentication & Authorization

- All endpoints require user authentication
- Only item owners can access their item's booking data
- Implement proper JWT token validation

### 2. Data Validation

- Validate date formats (YYYY-MM-DD)
- Ensure start_date < end_date
- Validate month format (YYYY-MM)
- Check item ownership before returning data

### 3. Performance Considerations

- Add database indexes for efficient querying
- Implement pagination for large datasets
- Consider caching for frequently accessed statistics
- Use database views for complex aggregations

### 4. Error Handling

- Return consistent error response format
- Log errors for debugging
- Provide meaningful error messages
- Handle edge cases (no bookings, invalid dates)

### 5. Security

- Sanitize all input parameters
- Prevent SQL injection attacks
- Rate limiting for API endpoints
- Validate user permissions

## Frontend Integration

The frontend will call these endpoints as follows:

```javascript
// Load bookings for a specific month
const response = await http.get(`/api/items/${itemId}/bookings`, {
  params: { month: "2024-01" },
});

// Get booking details
const booking = await http.get(`/api/bookings/${bookingId}`);

// Get statistics
const stats = await http.get(`/api/items/${itemId}/bookings/statistics`);
```

## Testing

### Unit Tests

- Test each endpoint with valid and invalid inputs
- Test authentication and authorization
- Test data validation
- Test error handling

### Integration Tests

- Test complete booking flow
- Test calendar data accuracy
- Test statistics calculations
- Test performance with large datasets

### Manual Testing

- Test with different user roles
- Test with various date ranges
- Test pagination functionality
- Test error scenarios

## Future Enhancements

1. **Real-time Updates**: WebSocket integration for live booking updates
2. **Export Functionality**: CSV/PDF export of booking data
3. **Advanced Filtering**: Filter by status, date range, customer
4. **Booking Analytics**: More detailed analytics and reporting
5. **Calendar Sync**: Integration with external calendar systems
6. **Mobile Optimization**: Responsive design for mobile devices
