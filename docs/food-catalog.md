# Plate branded-food catalog

Plate searches its own Supabase catalog before calling USDA FoodData Central or
Open Food Facts. This removes two third-party network requests from the normal
mobile search path.

## Local-only setup

Nothing in this branch is applied to staging automatically.

1. Open a separate Supabase development project (recommended) or a local
   Supabase instance.
2. Run
   `supabase/migrations/add_branded_food_catalog.sql` in its SQL editor.
3. Add these values to `.env.local`:

   ```text
   SUPABASE_URL=https://your-development-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-development-service-role-key
   ```

   Never expose or commit the service-role key. The catalog import scripts refuse
   to run with only the browser anon key.

4. Point `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` at the
   same development project if you want to test catalog search in the web app.

## Import USDA branded foods

Download the current **Branded Foods JSON** archive from the
[FoodData Central download page](https://fdc.nal.usda.gov/download-datasets).
The importer accepts the extracted `.json` file or a gzip-compressed JSON file:

```bash
npm run catalog:import:usda -- /path/to/FoodData_Central_branded_food.json
```

The import is streaming and upserts by USDA FDC ID, so reruns update existing
rows rather than duplicating them.

## Import Open Food Facts

Download the JSONL export from the
[Open Food Facts data page](https://world.openfoodfacts.org/data). The importer
accepts `.jsonl` or `.jsonl.gz`:

```bash
npm run catalog:import:off -- /path/to/openfoodfacts-products.jsonl.gz
```

The importer intentionally keeps only products tagged for the United States or
Canada and having usable nutrition data. It upserts by barcode.

Open Food Facts is licensed under the Open Database License (ODbL). Keep its
attribution visible in search and review share-alike requirements before
publishing a derived catalog.

## Search behavior

`search_branded_foods(query, limit)` uses Postgres trigram indexes and ranks:

1. exact names;
2. name prefixes;
3. brand prefixes;
4. fuzzy matches;
5. data completeness.

Queries shorter than two characters return no rows. Results are capped at 50.
If the catalog has no result (or the migration is not installed), the current
web app falls back to live USDA and Open Food Facts search.

## Verify

```bash
npm run test:catalog
```

After an import, validate the database:

```sql
SELECT source, COUNT(*)
FROM public.branded_foods
GROUP BY source;

SELECT *
FROM public.search_branded_foods('tillamook', 10);
```
