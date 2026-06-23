// 一回限りのマイグレーション適用スクリプト。
// 使い方: node scripts/apply-migration.mjs supabase/migrations/0001_init.sql
import { readFileSync } from 'node:fs'
import { Client } from 'pg'

const file = process.argv[2]
if (!file) {
  console.error('usage: node scripts/apply-migration.mjs <sqlfile>')
  process.exit(1)
}

const url = process.env.SUPABASE_DB_URL
if (!url) {
  console.error('SUPABASE_DB_URL not set')
  process.exit(1)
}

const sql = readFileSync(file, 'utf8')
const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })

try {
  await client.connect()
  await client.query(sql)
  console.log('migration applied:', file)
} catch (e) {
  console.error('migration failed:', e.message)
  process.exitCode = 1
} finally {
  await client.end()
}
