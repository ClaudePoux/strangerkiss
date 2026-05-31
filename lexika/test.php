<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

define('DB_HOST', 'nqmwgujcp.mysql.db');
define('DB_NAME', 'nqmwgujcp');
define('DB_USER', 'nqmwgujcp');
define('DB_PASS', 'jerkDerFF47zQlu');

try {
    $pdo = new PDO('mysql:host='.DB_HOST.';dbname='.DB_NAME.';charset=utf8mb4', DB_USER, DB_PASS);
    echo 'Connexion OK';
} catch (Exception $e) {
    echo 'Erreur : ' . $e->getMessage();
}
