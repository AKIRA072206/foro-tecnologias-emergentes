<?php
$cfg = require dirname(__DIR__) . '/config/database.php';
$dsn = sprintf('%s:host=%s;port=%s;dbname=%s', $cfg['driver'], $cfg['host'], $cfg['port'], $cfg['dbname']);
try {
    $pdo = new PDO($dsn, $cfg['user'], $cfg['password'], $cfg['options']);
    $n = $pdo->query('SELECT COUNT(*) FROM estudiantes')->fetchColumn();
    echo "PDO_OK count={$n}\n";
} catch (Throwable $e) {
    echo 'PDO_FAIL: ' . $e->getMessage() . PHP_EOL;
    exit(1);
}
