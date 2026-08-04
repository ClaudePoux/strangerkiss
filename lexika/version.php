<?php
declare(strict_types=1);
require_once __DIR__ . '/lexika-config.php';
header('Content-Type: application/json');
header('Cache-Control: no-store');
echo json_encode(['version' => ASSET_VERSION]);
