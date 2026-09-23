/**
 * One-off provisioning for the legacy Savortome database on a shared
 * RDS instance. Idempotent - safe to re-run.
 *
 * Env:
 *   ADMIN_DATABASE_URL - master credentials, pointing at the `postgres` db
 *   SB_DB_PASSWORD     - password for the `secondbreakfast` role
 *
 * Creates role `secondbreakfast`, database `secondbreakfast` owned by it, and
 * the pgvector extension (as master, so it works even where the extension
 * isn't trusted for regular owners).
 */
import pg from "pg";
import { connectionOptions } from '../src/connection.js';

const adminUrl = process.env.ADMIN_DATABASE_URL;
const password = process.env.SB_DB_PASSWORD;
if (!adminUrl || !password) {
  throw new Error("ADMIN_DATABASE_URL and SB_DB_PASSWORD are required");
}

const admin = new pg.Client(connectionOptions(adminUrl));
await admin.connect();

const role = await admin.query("SELECT 1 FROM pg_roles WHERE rolname = 'secondbreakfast'");
if (role.rowCount === 0) {
  // Identifier is fixed; only the password is interpolated, via a literal.
  await admin.query(`CREATE ROLE secondbreakfast LOGIN PASSWORD '${password.replace(/'/g, "''")}'`);
  console.log("role secondbreakfast: created");
} else {
  await admin.query(`ALTER ROLE secondbreakfast WITH LOGIN PASSWORD '${password.replace(/'/g, "''")}'`);
  console.log("role secondbreakfast: exists, password refreshed");
}
// RDS master isn't superuser; it can only create a database owned by a role
// it is a member of.
await admin.query("GRANT secondbreakfast TO CURRENT_USER");

const db = await admin.query("SELECT 1 FROM pg_database WHERE datname = 'secondbreakfast'");
if (db.rowCount === 0) {
  await admin.query("CREATE DATABASE secondbreakfast OWNER secondbreakfast");
  console.log("database secondbreakfast: created");
} else {
  console.log("database secondbreakfast: exists");
}
await admin.end();

const adminOnSb = new pg.Client(connectionOptions(adminUrl.replace(/\/postgres(\?|$)/, '/secondbreakfast$1')));
await adminOnSb.connect();
await adminOnSb.query("CREATE EXTENSION IF NOT EXISTS vector");
console.log("pgvector: ready");
await adminOnSb.end();

console.log("PROVISION DONE");
