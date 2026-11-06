<?php

namespace App\Http\Controllers\Auth;

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;
use App\Notifications\PasswordResetAlert;
use App\Notifications\AccountLockedNotification;

class AuthenticatedSessionController extends Controller
{
    /**
     * Display the login view.
     */
    public function create(): Response
    {
        return Inertia::render('Auth/Login', [
            'canResetPassword' => Route::has('password.request'),
            'status' => session('status'),
        ]);
    }

    /**
     * Handle an incoming authentication request.
     */
    public function store(LoginRequest $request): RedirectResponse
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required',
            'device_id' => 'required|string',
        ]);

        // Finds user in database
        $user = User::where('email', $request->email)->first();

        // 🟢 1. THE KILL SWITCH (Moved to top for better security)
        // If they are already disabled, stop them before checking anything else
        if ($user && $user->status === 'Disabled') {
            throw ValidationException::withMessages([
                'email' => 'This account has been disabled. Please contact the administrator.',
            ]);
        }

        // 2. CHECK CREDENTIALS & DEVICE
        if ($user) {
            if (Hash::check($request->password, $user->password)) {
                
                // --- SUCCESS: Reset strike counter to 0 ---
                if ($user->failed_login_attempts > 0) {
                    $user->update(['failed_login_attempts' => 0]);
                }

                // --- DEVICE AUTHORIZATION LOGIC ---
                $currentDevices = $user->authorized_device_ids ?? [];
                $attemptDevice = $request->device_id;

                if (!in_array($attemptDevice, $currentDevices)) {
                    if (count($currentDevices) >= $user->device_limit) {
                        throw ValidationException::withMessages([
                            'email' => "Device limit reached ($user->device_limit allowed). Please contact IT support for assistance.",
                        ]);
                    } 
                    $currentDevices[] = $attemptDevice;
                    $user->authorized_device_ids = $currentDevices;
                    $user->save();
                }

            } else {
                
                // --- FAIL: The 5-Strike Lockout Logic ---
                $user->increment('failed_login_attempts');

                if ($user->failed_login_attempts >= 5) {
                    // Lock the account
                    $user->update(['status' => 'Disabled']);

                    // Find Admins and send Database Notification
                    $admins = User::whereHas('role', function ($q) {
                        $q->where('name', 'Admin');
                    })->get();

                    if ($admins->isNotEmpty()) {
                        Notification::send($admins, new AccountLockedNotification($user));
                    }

                    // Kick them back to login
                    throw ValidationException::withMessages([
                        'email' => 'You have entered the wrong password 5 times. Your account is now disabled. Please contact IT.',
                    ]);
                }
                
                // If it's less than 5 strikes, we do nothing here and let $request->authenticate() 
                // handle throwing the standard "Wrong password" error below.
            }
        }

        // Proceed with normal authentication flow (Sets up the session securely)
        $request->authenticate();

        // If they are active, let them in!
        $request->session()->regenerate();

        // --- START OF LOGGING CODE (SUCCESSFUL LOGIN) ---
        // Placed here because they successfully passed all checks!
        \App\Models\SystemLog::create([
            'user_id' => Auth::id(), 
            'module' => 'Auth',
            'action' => 'Login',
            'description' => 'User logged in successfully.',
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'status' => 'success',
        ]);
        // --- END OF LOGGING CODE ---

        return redirect()->intended('/dashboard');
    }

    /**
     * Destroy an authenticated session.
     */
    public function destroy(Request $request): RedirectResponse
    {
        // Grab the user ID BEFORE logging them out so we can log it
        $userId = Auth::id();

        Auth::guard('web')->logout();

        $request->session()->invalidate();

        $request->session()->regenerateToken();

        // --- START OF LOGGING CODE (LOGOUT) ---
        if ($userId) {
            \App\Models\SystemLog::create([
                'user_id' => $userId,
                'module' => 'Auth',
                'action' => 'Logout',
                'description' => 'User logged out of the system.',
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'status' => 'success',
            ]);
        }
        // --- END OF LOGGING CODE ---

        return redirect('/');
    }

    public function requestPasswordReset(Request $request)
    {
        $request->validate([
            'email' => 'required|email|exists:users,email'
        ], [
            'email.exists' => 'We could not find an account with that email address.'
        ]);

        // 1. Find the user
        $user = User::where('email', $request->email)->first();

        // 2. Change their status to "Password Reset" (same spelling as the admin reset in EmployeeController)
        $user->update(['status' => 'Password Reset']);

        // 3. Find the Admins and notify them
        $admins = User::whereHas('role', function ($q) {
            $q->where('name', 'Admin');
        })->get();

        if ($admins->isNotEmpty()) {
            Notification::send($admins, new PasswordResetAlert($user));
        }

        return back()->with('status', 'The Admin team has been notified to reset your password.');
    }
}