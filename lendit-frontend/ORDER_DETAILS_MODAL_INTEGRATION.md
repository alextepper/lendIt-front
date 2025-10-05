# Order Details Modal Integration

## Overview

This document describes the integration of the OrderDetailsModal component with the BookingCalendar to display detailed order information when clicking on orders.

## Features

### 1. Clickable Order Items

- **Recent Bookings List**: Click on any booking item to view order details
- **Calendar Cells**: Click on calendar dates with bookings to view order details
- **Visual Feedback**: Hover effects indicate clickable elements

### 2. Order Details Modal

- **Complete Order Information**: Shows all order details including dates, pricing, status
- **User Information**: Displays renter and owner details with clickable profile links
- **Item Information**: Shows item details with clickable item link
- **Status Management**: Allows status updates (for owners/renters)
- **Action Buttons**: Hand over, mark returned, cancel order functionality

## Implementation

### Component Integration

```vue
<!-- BookingCalendar.vue -->
<template>
  <!-- Calendar and bookings list -->

  <!-- Order Details Modal -->
  <OrderDetailsModal
    v-if="showOrderModal && selectedOrder"
    :order="selectedOrder"
    @close="closeOrderModal"
    @updated="handleOrderUpdate"
  />
</template>

<script setup>
import OrderDetailsModal from "./OrderDetailsModal.vue";

// Modal state
const showOrderModal = ref(false);
const selectedOrder = ref(null);
</script>
```

### Data Transformation

The booking data is transformed to order format for the modal:

```javascript
function showOrderDetails(booking) {
  selectedOrder.value = {
    id: booking.id,
    itemId: props.itemId,
    renterId: booking.renter?.id,
    ownerId: booking.owner?.id,
    start: booking.startDate, // Maps startDate to start
    end: booking.endDate, // Maps endDate to end
    priceTotal: booking.priceTotal,
    currency: booking.currency,
    status: booking.status,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
    item: booking.item,
    renter: booking.renter,
    owner: booking.owner,
  };
  showOrderModal.value = true;
}
```

### Click Handlers

#### 1. Recent Bookings List

```vue
<div
  v-for="booking in currentMonthBookings.slice(0, 5)"
  :key="booking.id"
  class="booking-item"
  @click="showOrderDetails(booking)"
>
```

#### 2. Calendar Cells

```javascript
function onDateClick(date) {
  const bookings = getBookingsForDate(date);
  if (bookings.length > 0) {
    // Show the first booking's order details
    showOrderDetails(bookings[0]);
  }
}
```

## User Experience

### Visual Indicators

- **Hover Effects**: Booking items and calendar cells show hover states
- **Cursor Pointer**: Indicates clickable elements
- **Smooth Transitions**: 0.2s ease transitions for better UX

### Modal Behavior

- **Auto-close**: Modal closes when order is updated
- **Refresh Data**: Automatically refreshes bookings after updates
- **Error Handling**: Shows toast notifications for errors

## Order Details Modal Features

### Information Display

- **Order ID**: Unique identifier
- **Dates**: Start and end dates with duration
- **Pricing**: Total price and currency
- **Status**: Current order status with color coding
- **Timestamps**: Created and updated dates

### User Details

- **Renter Information**: Name, username, email with profile link
- **Owner Information**: Name, username, email with profile link
- **Item Information**: Title, photos with item link

### Actions (Based on User Role)

- **Hand Over**: Owner can mark item as handed over
- **Mark Returned**: Owner can mark item as returned
- **Cancel Order**: Both owner and renter can cancel (if allowed)

## Status Flow

```
PENDING → PAID → HANDED_OVER → RETURNED
    ↓        ↓
CANCELLED  CANCELLED
```

### Status Colors

- **PENDING**: Warning (yellow)
- **PAID**: Info (blue)
- **HANDED_OVER**: Primary (blue)
- **RETURNED**: Success (green)
- **CANCELLED**: Danger (red)

## Error Handling

### API Errors

- **Network Issues**: Toast notification with retry option
- **Permission Errors**: Appropriate error messages
- **Validation Errors**: Field-specific error display

### UI Errors

- **Modal State**: Proper cleanup on errors
- **Data Validation**: Checks for required fields
- **Loading States**: Shows loading indicators during updates

## Testing

### Manual Testing

1. **Navigate to Item Page**: As owner, go to an item with orders
2. **Click Recent Booking**: Click on any booking in the recent list
3. **Click Calendar Date**: Click on a calendar date with bookings
4. **Verify Modal**: Check that order details are displayed correctly
5. **Test Actions**: Try status updates (if applicable)
6. **Test Close**: Close modal and verify it reopens correctly

### Test Cases

- [ ] Recent bookings list shows clickable items
- [ ] Calendar cells with bookings are clickable
- [ ] Modal displays correct order information
- [ ] User information links work correctly
- [ ] Item information links work correctly
- [ ] Status updates work (if user has permission)
- [ ] Modal closes after successful update
- [ ] Data refreshes after update
- [ ] Error handling works correctly

## Future Enhancements

### Planned Features

1. **Bulk Actions**: Select multiple orders for batch operations
2. **Order Filtering**: Filter orders by status, date range
3. **Export Functionality**: Export order details to PDF/CSV
4. **Real-time Updates**: WebSocket integration for live updates
5. **Order History**: Track all status changes over time

### UI Improvements

1. **Loading Skeletons**: Better loading states
2. **Animation**: Smooth modal transitions
3. **Keyboard Navigation**: Arrow keys for navigation
4. **Mobile Optimization**: Better mobile experience
5. **Accessibility**: WCAG compliance improvements

## Troubleshooting

### Common Issues

1. **Modal Not Opening**: Check console for JavaScript errors
2. **Data Not Loading**: Verify API endpoint is working
3. **Status Update Fails**: Check user permissions
4. **Links Not Working**: Verify router configuration

### Debug Information

- Check browser console for error messages
- Verify order data structure matches expected format
- Check network tab for API call failures
- Verify user authentication status

This integration provides a seamless way to view and manage order details directly from the booking calendar, improving the user experience for both owners and renters.
