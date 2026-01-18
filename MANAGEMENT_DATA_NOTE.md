# ⚠️ Important: management_data.json

The file `public/data/management_data.json` is currently a **template** with empty data.

## Required Action

**You MUST replace the template with your actual legacy data** (2024/2025) in this format:

```json
{
  "store_meta": {
    "1001": {
      "manager": "اسم المدير",
      "store_name": "اسم المعرض",
      "outlet": "اسم المعرض",
      "city": "المدينة"
    },
    "1002": { ... }
  },
  "sales": [
    ["2024-01-15", "1001", 15000.50],
    ["2024-01-15", "1002", 20000.00],
    ...
  ],
  "visitors": [
    ["2024-01-15", "1001", 500],
    ["2024-01-15", "1002", 600],
    ...
  ],
  "transactions": [
    ["2024-01-15", "1001", 45],
    ["2024-01-15", "1002", 50],
    ...
  ],
  "targets": {
    "2024": {
      "1001": {
        "1": 500000,
        "2": 500000,
        ...
      }
    }
  }
}
```

## File Location

- Source: `public/data/management_data.json`
- After build: `dist/data/management_data.json` (Vercel) or `/k.a-cockpit/data/management_data.json` (GitHub Pages)

## Access URL

- Vercel: `/data/management_data.json`
- GitHub Pages: `/k.a-cockpit/data/management_data.json`

The `legacyProvider.ts` automatically uses `import.meta.env.BASE_URL` to construct the correct path.
