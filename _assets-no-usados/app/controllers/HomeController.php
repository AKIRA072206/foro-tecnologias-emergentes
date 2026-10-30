<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Controller;

class HomeController extends Controller
{
    public function index(): void
    {
        // Los estudiantes reciben solo el enlace de registro
        $this->redirect('/registro');
    }
}
