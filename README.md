# Finances-v2
A proper rewrite of my finances webapp using Node and SQL

## Setup

1. Configure `docker-compose.yml` and `sql-config.json` fields to match.
2. Pull the necessary images. `docker compose pull`
3. Start the images. `docker compose up -d`
4. Initialize the database from `db-config.sql`. Personally I just copy the text into adminer.
5. Navigate to `localhost:3000`.
