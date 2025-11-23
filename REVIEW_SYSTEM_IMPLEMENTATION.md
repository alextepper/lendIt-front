# Review System Implementation

## Overview

This document describes the complete review system implementation for the LendIt application, including all components, services, and API integrations.

## API Endpoints

### Create Review

- **POST** `/orders/:orderId/reviews`
- **Auth**: Must be order.renterId or order.ownerId
- **Body (Rental Experience)**:
  ```json
  {
    "subjectType": "RENTAL_EXPERIENCE",
    "ratingOverall": 5,
    "ratingsBreakdown": {
      "item_quality": 5,
      "communication_with_owner": 5
    },
    "title": "Great experience!",
    "body": "The item was exactly as described...",
    "photos": ["base64_image_data"],
    "isAnonymous": false
  }
  ```
- **Body (Renter Review)**:
  ```json
  {
    "subjectType": "RENTER",
    "ratingOverall": 4,
    "ratingsBreakdown": {
      "care_of_item": 4,
      "punctuality": 5
    }
  }
  ```

### Respond to Review

- **POST** `/reviews/:reviewId/response`
- **Body**: `{ "responseText": "Thanks for your feedback!" }`

### Mark Review Helpful

- **POST** `/reviews/:reviewId/helpful`
- **DELETE** `/reviews/:reviewId/helpful`

### Report Review

- **POST** `/reviews/:reviewId/report`
- **Body**: `{ "reason": "abusive", "details": "..." }`

### Get Reviews

- **GET** `/items/:itemId/reviews?sort=NEWEST|TOP|RATING&offset=0&limit=20`
- **GET** `/users/:userId/reviews/received?role=owner|renter&sort=NEWEST|TOP|RATING&offset=0&limit=20`
- **GET** `/users/:userId/reviews/given?offset=0&limit=20`
- **GET** `/reviews/:reviewId`

## Components

### 1. ReviewForm.vue

**Purpose**: Form for creating new reviews

**Features**:

- Review type selection (Rental Experience vs Renter Review)
- Overall rating (1-5 stars)
- Detailed breakdown ratings
- Title and description (for rental experience)
- Photo upload (for rental experience)
- Anonymous option
- Form validation

**Props**:

- `orderId`: Order ID for the review
- `canReviewRenter`: Whether user can review the renter
- `defaultSubjectType`: Default review type

**Events**:

- `@submit`: Review submitted
- `@cancel`: Form cancelled

### 2. ReviewItem.vue

**Purpose**: Display individual review with all interactions

**Features**:

- Review header with reviewer info and rating
- Breakdown ratings display
- Review content with photos
- Owner response section
- Action buttons (helpful, respond, report)
- Response form for owners

**Props**:

- `review`: Review object
- `canRespond`: Whether current user can respond

**Events**:

- `@update`: Review updated (helpful status changed)
- `@respond`: Response submitted

### 3. ReviewModal.vue

**Purpose**: Modal wrapper for review creation

**Features**:

- Bootstrap modal integration
- ReviewForm integration
- Modal state management

**Props**:

- `orderId`: Order ID
- `canReviewRenter`: Can review renter
- `defaultSubjectType`: Default type
- `isEditing`: Edit mode (future feature)

**Methods**:

- `show()`: Show modal
- `hide()`: Hide modal

### 4. ReviewsSection.vue (Updated)

**Purpose**: Main reviews display section

**Features**:

- Review aggregation display
- Sort options (Newest, Oldest, Rating, Helpful)
- Review list with ReviewItem components
- Write review button
- Pagination
- Error handling

**Props**:

- `itemId`: Item ID
- `canReview`: Can write reviews
- `reviews`: External reviews data (optional)
- `loading`: External loading state (optional)
- `error`: External error state (optional)
- `orderId`: Order ID for review creation
- `canReviewRenter`: Can review renter

**Events**:

- `@refresh`: Refresh reviews
- `@review-submitted`: Review submitted

## Services

### reviewsService.js (Updated)

**New Functions**:

- `createOrderReview(orderId, reviewData)`: Create review for order
- `respondToReview(reviewId, responseText)`: Respond to review
- `markReviewHelpful(reviewId)`: Mark as helpful
- `unmarkReviewHelpful(reviewId)`: Remove helpful mark
- `reportReview(reviewId, reason, details)`: Report review
- `fetchUserReviewsReceived(userId, role, params)`: Get received reviews
- `fetchUserReviewsGiven(userId, params)`: Get given reviews
- `fetchReviewById(reviewId)`: Get specific review

**Updated Functions**:

- `fetchItemReviews(itemId, params)`: Updated with new API structure

## Usage Examples

### 1. Basic Item Reviews

```vue
<ReviewsSection
  :item-id="itemId"
  :can-review="!isOwner"
  :reviews="reviews"
  :loading="loadingReviews"
  :error="reviewsError"
  @refresh="loadReviews"
/>
```

### 2. Order-Based Reviews

```vue
<ReviewsSection
  :item-id="itemId"
  :order-id="orderId"
  :can-review="true"
  :can-review-renter="isOwner"
  @review-submitted="handleReviewSubmitted"
/>
```

### 3. Creating a Review

```vue
<ReviewForm
  :order-id="orderId"
  :can-review-renter="canReviewRenter"
  default-subject-type="RENTAL_EXPERIENCE"
  @submit="handleReviewSubmit"
  @cancel="closeForm"
/>
```

### 4. Displaying Reviews

```vue
<ReviewItem
  v-for="review in reviews"
  :key="review.id"
  :review="review"
  :can-respond="isOwner"
  @update="refreshReviews"
  @respond="handleResponse"
/>
```

## Data Structures

### Review Object

```typescript
interface Review {
  id: string;
  subjectType: "RENTAL_EXPERIENCE" | "RENTER";
  ratingOverall: number;
  ratingsBreakdown: {
    item_quality?: number;
    communication_with_owner?: number;
    care_of_item?: number;
    punctuality?: number;
  };
  title?: string;
  body: string;
  photos?: string[];
  isAnonymous: boolean;
  reviewer: {
    id: string;
    name: string;
    avatar?: string;
  };
  createdAt: string;
  helpfulCount: number;
  isHelpful: boolean;
  response?: {
    responseText: string;
    createdAt: string;
  };
}
```

### Review Form Data

```typescript
interface ReviewFormData {
  subjectType: "RENTAL_EXPERIENCE" | "RENTER";
  ratingOverall: number;
  ratingsBreakdown: {
    item_quality: number;
    communication_with_owner: number;
    care_of_item: number;
    punctuality: number;
  };
  title: string;
  body: string;
  photos: string[];
  isAnonymous: boolean;
}
```

## Styling

### CSS Classes

- `.review-form`: Main form container
- `.review-item`: Individual review container
- `.rating-input`: Rating input section
- `.breakdown-ratings`: Detailed ratings section
- `.photo-upload`: Photo upload area
- `.review-actions`: Action buttons section
- `.response-form`: Response form section

### Responsive Design

- Mobile-first approach
- Flexible grid layouts
- Touch-friendly buttons
- Optimized for small screens

## Error Handling

### API Errors

- Network errors: Show retry option
- Validation errors: Display field-specific messages
- Permission errors: Show appropriate messaging
- Rate limiting: Inform user of limits

### UI Errors

- Form validation: Real-time feedback
- File upload: Size and type validation
- Network issues: Offline indicators

## Future Enhancements

### Planned Features

1. **Review Editing**: Allow users to edit their reviews
2. **Photo Management**: Better photo upload and management
3. **Review Moderation**: Admin tools for review management
4. **Advanced Filtering**: Filter by rating, date, type
5. **Review Analytics**: Statistics and insights
6. **Bulk Actions**: Mass operations on reviews

### Technical Improvements

1. **Caching**: Implement review data caching
2. **Real-time Updates**: WebSocket integration
3. **Offline Support**: PWA capabilities
4. **Performance**: Virtual scrolling for large lists
5. **Accessibility**: WCAG compliance improvements

## Testing

### Unit Tests

- Component rendering
- Form validation
- API integration
- Error handling

### Integration Tests

- Review creation flow
- Review display
- User interactions
- API responses

### E2E Tests

- Complete review workflow
- Cross-browser compatibility
- Mobile responsiveness

## Security Considerations

### Data Validation

- Client-side validation
- Server-side validation
- XSS prevention
- CSRF protection

### Privacy

- Anonymous review option
- Data retention policies
- GDPR compliance
- User consent management

## Performance Optimization

### Loading

- Lazy loading of reviews
- Pagination
- Image optimization
- Bundle splitting

### Caching

- API response caching
- Component caching
- Image caching
- CDN integration

## Deployment

### Environment Variables

- API base URL
- Feature flags
- Debug settings
- Analytics keys

### Build Process

- Component compilation
- CSS optimization
- Asset bundling
- Code splitting

This implementation provides a comprehensive review system that supports both rental experience reviews and renter reviews, with full CRUD operations, user interactions, and responsive design.
