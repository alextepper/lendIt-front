# Date Blocking Feature

## Overview

This document describes the date blocking feature added to the BookingCalendar component, allowing item owners to block specific date ranges and prevent bookings during those periods.

## Features

### 1. Block Dates Button

- **Location**: Calendar header next to the refresh button
- **Visual**: Orange/warning colored button with calendar-x icon
- **Functionality**: Opens the blocking modal when clicked

### 2. Blocking Modal

- **Date Range Selection**: Start and end date inputs
- **Reason Field**: Optional text area for blocking reason
- **Validation**: Ensures end date is after start date
- **Loading States**: Shows spinner during API call

### 3. API Integration

- **Endpoint**: `POST /orders/blocking`
- **Authentication**: Bearer token required
- **Payload**: Item ID, start date, end date, and optional reason

## Implementation

### Component State

```javascript
// Blocking modal state
const showBlockingModal = ref(false);
const blockingForm = ref({
  startDate: "",
  endDate: "",
  reason: "",
});
const blockingLoading = ref(false);
```

### API Call Function

```javascript
async function submitBlocking() {
  if (!blockingForm.value.startDate || !blockingForm.value.endDate) {
    ui.showToast("Please select both start and end dates", "warning");
    return;
  }

  if (
    new Date(blockingForm.value.startDate) >=
    new Date(blockingForm.value.endDate)
  ) {
    ui.showToast("End date must be after start date", "warning");
    return;
  }

  blockingLoading.value = true;

  try {
    const response = await http.post("/orders/blocking", {
      itemId: props.itemId,
      start: new Date(blockingForm.value.startDate).toISOString(),
      end: new Date(blockingForm.value.endDate).toISOString(),
      blockingReason: blockingForm.value.reason || undefined,
    });

    ui.showToast("Date range blocked successfully", "success");
    closeBlockingModal();
    emit("refresh");
  } catch (error) {
    console.error("Failed to block date range:", error);
    ui.showToast(
      error?.response?.data?.message || "Failed to block date range",
      "danger"
    );
  } finally {
    blockingLoading.value = false;
  }
}
```

### UI Components

#### Block Dates Button

```vue
<button
  class="btn btn-outline-warning btn-sm me-2"
  @click="showBlockingForm"
  :disabled="loading"
>
  <i class="bi bi-calendar-x me-1"></i>
  Block Dates
</button>
```

#### Blocking Modal

```vue
<div
  v-if="showBlockingModal"
  class="modal fade show d-block"
  tabindex="-1"
  style="background-color: rgba(0,0,0,0.5);"
>
  <div class="modal-dialog">
    <div class="modal-content">
      <!-- Modal content with form -->
    </div>
  </div>
</div>
```

## API Specification

### Request Format

```http
POST /orders/blocking
Authorization: Bearer <token>
Content-Type: application/json

{
  "itemId": "item-id",
  "start": "2024-01-15T00:00:00.000Z",
  "end": "2024-01-20T00:00:00.000Z",
  "blockingReason": "Maintenance period" // optional
}
```

### Response Format

**Success (200/201):**

```json
{
  "success": true,
  "message": "Date range blocked successfully",
  "data": {
    "id": "blocking-id",
    "itemId": "item-id",
    "start": "2024-01-15T00:00:00.000Z",
    "end": "2024-01-20T00:00:00.000Z",
    "blockingReason": "Maintenance period",
    "createdAt": "2024-01-10T10:00:00.000Z"
  }
}
```

**Error (400/401/403/404):**

```json
{
  "success": false,
  "message": "Error message",
  "error": "Validation error details"
}
```

## User Experience

### Visual Design

- **Warning Theme**: Orange/yellow color scheme to indicate blocking
- **Gradient Header**: Attractive gradient background for modal header
- **Smooth Animations**: Hover effects and transitions
- **Loading States**: Spinner and disabled states during API calls

### Form Validation

- **Required Fields**: Start and end dates must be selected
- **Date Logic**: End date must be after start date
- **Real-time Feedback**: Immediate validation messages
- **Button States**: Submit button disabled until valid data

### Error Handling

- **Network Errors**: Toast notifications with retry option
- **Validation Errors**: Field-specific error messages
- **Permission Errors**: Appropriate error messages
- **Loading States**: Visual feedback during operations

## Styling

### Modal Styling

```css
.modal-header {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border-bottom: 1px solid #f59e0b;
}

.modal-title {
  color: #92400e;
  font-weight: 600;
}

.btn-warning {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  border: none;
  color: white;
  font-weight: 500;
}

.btn-warning:hover {
  background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
}
```

### Form Styling

```css
.form-control:focus {
  border-color: #f59e0b;
  box-shadow: 0 0 0 0.2rem rgba(245, 158, 11, 0.25);
}
```

## Usage Flow

### 1. Access Blocking Feature

1. Navigate to item page as owner
2. View booking calendar
3. Click "Block Dates" button in header

### 2. Select Date Range

1. Choose start date from date picker
2. Choose end date from date picker
3. Optionally enter reason for blocking
4. Click "Block Dates" to submit

### 3. Confirmation

1. Success toast notification appears
2. Modal closes automatically
3. Calendar refreshes to show blocked dates
4. Blocked dates appear in calendar (if backend supports)

## Integration Points

### Calendar Refresh

- **Auto-refresh**: Calendar data refreshes after successful blocking
- **Event Emission**: `emit('refresh')` triggers parent component refresh
- **Data Sync**: Ensures blocked dates appear in calendar

### Toast Notifications

- **Success**: "Date range blocked successfully"
- **Validation**: "Please select both start and end dates"
- **Error**: API error messages or generic failure message

### Loading States

- **Button Disabled**: During API call
- **Spinner**: Visual loading indicator
- **Form Disabled**: Prevents multiple submissions

## Testing

### Manual Testing

1. **Navigate to Item**: Go to item page as owner
2. **Click Block Dates**: Verify modal opens
3. **Select Dates**: Choose valid date range
4. **Submit Form**: Verify API call and success message
5. **Check Calendar**: Verify calendar refreshes
6. **Test Validation**: Try invalid date ranges

### Test Cases

- [ ] Block dates button appears for owners
- [ ] Modal opens when button clicked
- [ ] Date validation works correctly
- [ ] API call succeeds with valid data
- [ ] Success message appears
- [ ] Calendar refreshes after blocking
- [ ] Error handling works for API failures
- [ ] Loading states display correctly
- [ ] Modal closes after successful submission

## Future Enhancements

### Planned Features

1. **Visual Calendar Selection**: Click and drag to select date ranges
2. **Recurring Blocks**: Block same dates every week/month
3. **Block Management**: View and delete existing blocks
4. **Conflict Detection**: Warn about overlapping bookings
5. **Bulk Operations**: Block multiple date ranges at once

### UI Improvements

1. **Date Range Picker**: More intuitive date selection
2. **Calendar Preview**: Show blocked dates in modal
3. **Quick Actions**: Common blocking periods (weekend, holidays)
4. **Mobile Optimization**: Better mobile experience
5. **Accessibility**: WCAG compliance improvements

## Troubleshooting

### Common Issues

1. **Modal Not Opening**: Check console for JavaScript errors
2. **API Call Fails**: Verify authentication and endpoint
3. **Validation Errors**: Check date format and logic
4. **Calendar Not Refreshing**: Verify emit('refresh') is called

### Debug Information

- Check browser console for error messages
- Verify API endpoint is accessible
- Check network tab for request/response details
- Verify user has owner permissions

This feature provides item owners with an easy way to block date ranges and prevent bookings during maintenance periods, personal use, or other unavailable times.
