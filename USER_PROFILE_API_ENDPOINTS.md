# User Profile API Endpoints

This document outlines the required backend endpoints to support the User Profile feature with dual ratings system.

## Overview

The User Profile feature allows users to view other users' profiles, including their dual ratings (as renter and as owner), listings, and reviews. This provides transparency and builds trust in the platform.

## Required Endpoints

### 1. Get User Profile

**Endpoint:** `GET /api/users/:userId/profile`

**Description:** Retrieve a user's public profile information including dual ratings.

**Response Format:**

```json
{
  "success": true,
  "data": {
    "id": "user_123",
    "username": "johndoe",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "avatar": "https://example.com/avatar.jpg",
    "bio": "Passionate about sharing quality items",
    "location": "Tel Aviv, Israel",
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-20T15:45:00Z",
    "renterRating": 4.8,
    "ownerRating": 4.6,
    "renterReviewCount": 25,
    "ownerReviewCount": 18,
    "totalBookings": 43,
    "responseRate": 95,
    "isVerified": true,
    "joinedDate": "2024-01-15T10:30:00Z"
  }
}
```

**Status Codes:**

- `200`: Success
- `404`: User not found
- `500`: Internal server error

### 2. Get User Reviews

**Endpoint:** `GET /api/users/:userId/reviews`

**Description:** Retrieve reviews for a specific user (both as renter and as owner).

**Query Parameters:**

- `page` (optional): Page number for pagination (default: 1)
- `limit` (optional): Number of reviews per page (default: 20)
- `type` (optional): Filter by review type ("renter" or "owner")
- `sort` (optional): Sort order ("newest", "oldest", "rating_high", "rating_low")

**Response Format:**

```json
{
  "success": true,
  "data": {
    "reviews": [
      {
        "id": "review_123",
        "rating": 5,
        "comment": "Excellent renter! Very responsible and took great care of my camera.",
        "type": "renter", // "renter" or "owner"
        "createdAt": "2024-01-20T14:30:00Z",
        "reviewer": {
          "id": "user_456",
          "username": "sarahsmith",
          "firstName": "Sarah",
          "lastName": "Smith",
          "avatar": "https://example.com/sarah-avatar.jpg"
        },
        "item": {
          "id": "item_789",
          "title": "Professional Camera",
          "photos": ["https://example.com/camera1.jpg"]
        },
        "booking": {
          "id": "booking_101",
          "startDate": "2024-01-15",
          "endDate": "2024-01-17"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 43,
      "totalPages": 3
    },
    "summary": {
      "totalReviews": 43,
      "renterReviews": 25,
      "ownerReviews": 18,
      "averageRating": 4.7,
      "ratingDistribution": {
        "5": 30,
        "4": 8,
        "3": 3,
        "2": 1,
        "1": 1
      }
    }
  }
}
```

### 3. Get User Listings

**Endpoint:** `GET /api/users/:userId/listings`

**Description:** Retrieve all listings created by a specific user.

**Query Parameters:**

- `page` (optional): Page number for pagination (default: 1)
- `limit` (optional): Number of listings per page (default: 20)
- `status` (optional): Filter by listing status ("active", "inactive", "all")
- `category` (optional): Filter by category
- `sort` (optional): Sort order ("newest", "oldest", "price_low", "price_high", "rating")

**Response Format:**

```json
{
  "success": true,
  "data": {
    "listings": [
      {
        "id": "item_123",
        "title": "Professional Camera",
        "description": "High-quality camera for photography enthusiasts",
        "category": "Electronics",
        "location": "Tel Aviv, Israel",
        "pricePerDay": 5000,
        "initialPrice": 2000,
        "deposit": 3000,
        "currency": "ILS",
        "photos": [
          {
            "url": "https://example.com/camera1.jpg",
            "alt": "Camera front view"
          }
        ],
        "rating": 4.8,
        "reviewCount": 15,
        "isActive": true,
        "createdAt": "2024-01-10T09:00:00Z",
        "updatedAt": "2024-01-20T16:30:00Z",
        "owner": {
          "id": "user_123",
          "username": "johndoe",
          "firstName": "John",
          "lastName": "Doe",
          "avatar": "https://example.com/avatar.jpg"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 8,
      "totalPages": 1
    },
    "summary": {
      "totalListings": 8,
      "activeListings": 6,
      "inactiveListings": 2,
      "totalBookings": 45,
      "averageRating": 4.7
    }
  }
}
```

## Database Schema Requirements

### Users Table (Extended)

```sql
ALTER TABLE users ADD COLUMN (
  bio TEXT,
  location VARCHAR(255),
  avatar VARCHAR(500),
  is_verified BOOLEAN DEFAULT FALSE,
  response_rate INT DEFAULT 0,
  total_bookings INT DEFAULT 0,
  renter_rating DECIMAL(3,2) DEFAULT 0.00,
  owner_rating DECIMAL(3,2) DEFAULT 0.00,
  renter_review_count INT DEFAULT 0,
  owner_review_count INT DEFAULT 0
);
```

### Reviews Table

```sql
CREATE TABLE reviews (
  id VARCHAR(36) PRIMARY KEY,
  reviewer_id VARCHAR(36) NOT NULL,
  reviewee_id VARCHAR(36) NOT NULL,
  item_id VARCHAR(36) NOT NULL,
  booking_id VARCHAR(36) NOT NULL,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  type ENUM('renter', 'owner') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewee_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,

  UNIQUE KEY unique_booking_review (booking_id, reviewer_id, type),
  INDEX idx_reviewee (reviewee_id),
  INDEX idx_reviewer (reviewer_id),
  INDEX idx_type (type),
  INDEX idx_created_at (created_at)
);
```

### User Statistics View

```sql
CREATE VIEW user_statistics AS
SELECT
  u.id,
  u.username,
  u.first_name,
  u.last_name,
  u.avatar,
  u.bio,
  u.location,
  u.is_verified,
  u.created_at,

  -- Renter statistics
  COALESCE(renter_stats.avg_rating, 0) as renter_rating,
  COALESCE(renter_stats.review_count, 0) as renter_review_count,

  -- Owner statistics
  COALESCE(owner_stats.avg_rating, 0) as owner_rating,
  COALESCE(owner_stats.review_count, 0) as owner_review_count,

  -- General statistics
  COALESCE(booking_stats.total_bookings, 0) as total_bookings,
  COALESCE(response_stats.response_rate, 0) as response_rate

FROM users u
LEFT JOIN (
  SELECT
    reviewee_id,
    AVG(rating) as avg_rating,
    COUNT(*) as review_count
  FROM reviews
  WHERE type = 'renter'
  GROUP BY reviewee_id
) renter_stats ON u.id = renter_stats.reviewee_id
LEFT JOIN (
  SELECT
    reviewee_id,
    AVG(rating) as avg_rating,
    COUNT(*) as review_count
  FROM reviews
  WHERE type = 'owner'
  GROUP BY reviewee_id
) owner_stats ON u.id = owner_stats.reviewee_id
LEFT JOIN (
  SELECT
    renter_id,
    COUNT(*) as total_bookings
  FROM bookings
  WHERE status IN ('CONFIRMED', 'COMPLETED')
  GROUP BY renter_id
) booking_stats ON u.id = booking_stats.renter_id
LEFT JOIN (
  SELECT
    owner_id,
    ROUND(
      (COUNT(CASE WHEN response_time IS NOT NULL THEN 1 END) * 100.0 / COUNT(*)),
      0
    ) as response_rate
  FROM bookings b
  JOIN items i ON b.item_id = i.id
  WHERE b.status IN ('CONFIRMED', 'COMPLETED', 'CANCELLED')
  GROUP BY owner_id
) response_stats ON u.id = response_stats.owner_id;
```

## Implementation Notes

### 1. Authentication & Authorization

- User profile endpoints are public (no authentication required)
- Only return public information (no sensitive data like email for non-owners)
- Implement rate limiting to prevent abuse

### 2. Data Privacy

- Only show public profile information
- Hide sensitive data (email, phone) unless user is viewing their own profile
- Allow users to control what information is public

### 3. Performance Considerations

- Use database views for complex statistics calculations
- Implement caching for frequently accessed profiles
- Add proper database indexes for efficient querying
- Use pagination for large datasets

### 4. Rating System

- Separate ratings for renter and owner roles
- Calculate average ratings from reviews
- Update user statistics when new reviews are added
- Handle edge cases (no reviews, deleted reviews)

### 5. Review System

- One review per booking per role (renter can review owner, owner can review renter)
- Prevent self-reviews
- Allow editing reviews within time limit
- Soft delete reviews (mark as deleted, don't remove)

## Frontend Integration

The frontend will call these endpoints as follows:

```javascript
// Load user profile
const user = await getUserById(userId);

// Load user reviews
const reviews = await getUserReviews(userId, {
  page: 1,
  limit: 20,
  type: "renter", // optional filter
});

// Load user listings
const listings = await fetchUserListings(userId, {
  page: 1,
  limit: 20,
  status: "active",
});
```

## Testing

### Unit Tests

- Test each endpoint with valid and invalid user IDs
- Test pagination functionality
- Test filtering and sorting options
- Test rating calculations

### Integration Tests

- Test complete user profile flow
- Test review creation and rating updates
- Test listing display and filtering
- Test performance with large datasets

### Manual Testing

- Test with different user types (new users, users with many reviews)
- Test pagination and filtering
- Test responsive design
- Test error handling

## Future Enhancements

1. **Profile Customization**: Allow users to customize their profile appearance
2. **Social Features**: Follow users, see activity feed
3. **Achievement System**: Badges for milestones (100 bookings, 5-star rating)
4. **Advanced Analytics**: Detailed statistics and insights
5. **Profile Verification**: Enhanced verification system
6. **Recommendations**: Suggest similar users or items
