#!/bin/bash

# DO NOT PUSH THIS FILE TO GITHUB
# This file contains sensitive information and should be kept private

# TODO: Set your PostgreSQL URI - Use the External Database URL from the Render dashboard
PG_URI="postgresql://users_db_o364_user:5ozK3IfAfUIiU0L4XprWRQE5f1ilQin1@dpg-ct0bpclumphs73f3qem0-a.oregon-postgres.render.com/users_db_o364"

# Execute each .sql file in the directory
for file in src/init_data/*.sql; do
    echo "Executing $file..."
    psql $PG_URI -f "$file"
done