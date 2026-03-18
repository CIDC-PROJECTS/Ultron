# Ultron

Node.js + Express backend for FC Food App.

Current storage:

- Supabase (Postgres) for: menu items, orders + order items, tables, settings
- Supabase Storage for: menu item images
- MongoDB is still used for any routes not migrated yet (e.g. categories)

## Stack

- Node.js
- Express
- Supabase (Postgres + Storage)
- MongoDB (Mongoose) for non-migrated resources

## Quick Start

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create your environment file:

   ```bash
   copy .env.example .env
   ```

3. Update `MONGO_URI` in `.env`.

4. Create the Supabase tables:
   - Run the SQL in `supabase/schema.sql` in the Supabase SQL editor.
   - Create a public Storage bucket named `menu-images`.

5. Update Supabase env vars in `.env`.

6. Start development server:

   ```bash
   npm run dev
   ```

The API runs at `http://localhost:5000` by default.

## Environment Variables

- `PORT` - API port (default: `5000`)
- `MONGO_URI` - MongoDB connection string
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (server-side only)
- `SUPABASE_MENU_IMAGES_BUCKET` - Storage bucket name (default: `menu-images`)
- `ADMIN_EMAIL`, `ADMIN_PASSWORD` - default admin credentials (used only if settings row doesn't exist yet)

## Data Models

### orders

- `id` (string, unique)
- `user_id` (string)
- `table_id` (string)
- `status` (enum: `Pending | Preparing | Delivered | Cancelled`)
- `total` (number)
- `payment_status` (enum: `Pending | Paid | Failed | Refunded`)
- `created_at` (date)

### order_items

- `id` (string, unique)
- `order_id` (string)
- `menu_id` (string)
- `quantity` (number)
- `price` (number)

## API Endpoints

Base URL: `/api`

- `GET /health`
- `GET /orders`
- `POST /orders`
- `GET /orders/:id`
- `GET /orders/:id/items`
- `PATCH /orders/:id`
- `PATCH /orders/:id/status`
- `PATCH /orders/:id/payment-status`
- `DELETE /orders/:id`

## Sample Create Order Request

`POST /api/orders`

```json
{
  "user_id": "U-1001",
  "table_id": "T-04",
  "status": "Pending",
  "payment_status": "Pending",
  "items": [
    {
      "menu_id": "M-001",
      "quantity": 2,
      "price": 8.5
    },
    {
      "menu_id": "M-010",
      "quantity": 1,
      "price": 3
    }
  ]
}
```

## Query Filters for `GET /api/orders`

- `status`
- `payment_status`
- `user_id`
- `table_id`
- `from` (date)
- `to` (date)
- `page`
- `limit`
- `sort_by` (`created_at` or `total`)
- `sort_order` (`asc` or `desc`)
