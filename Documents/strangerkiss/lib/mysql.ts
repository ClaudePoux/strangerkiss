import mysql from "mysql2/promise";

// Pool de connexions MySQL OVH
// connectionLimit réduit car OVH mutualisé limite les connexions simultanées
export const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  port: parseInt(process.env.MYSQL_PORT ?? "3306", 10),
  database: process.env.MYSQL_DATABASE,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  waitForConnections: true,
  connectionLimit: 5,
  charset: "utf8mb4",
  timezone: "Z",
});

export const mysqlReady = !!(
  process.env.MYSQL_HOST &&
  process.env.MYSQL_DATABASE &&
  process.env.MYSQL_USER &&
  process.env.MYSQL_PASSWORD
);
