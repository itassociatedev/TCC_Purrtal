<?php

namespace App\Http\Controllers\Auth;

use App\Models\User;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\Notification;
use Illuminate\Auth\Events\PasswordReset;
use App\Notifications\PasswordResetSuccess;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class SetupAccountController extends Controller
{
    public function showSetupForm(Request $request)
    {
        $request->validate([
            'token' => 'required',
            'email' => 'required|email',
        ]);

        $email = $request->email;
        $token = $request->token;

        // 1. Find the user by their email address
        $user = User::where('email', $email)->first();

        if (!$user) {
            return redirect()->route('login')->with('error', 'Invalid request. Please contact IT support for assistance.');
        }

        // 2. THE FIX: Use the repository to securely check the hashed token
        $isValidToken = Password::broker()->getRepository()->exists($user, $token);

        if (!$isValidToken) {
            // 🟢 SMART ERROR DETECTION: Check if they clicked an old link in an email thread
            $dbTokenRecord = DB::table('password_reset_tokens')->where('email', $email)->first();
            
            if ($dbTokenRecord) {
                // A token exists for this email in the DB, but the one in the URL doesn't match!
                // This proves they clicked an older email link inside an email thread.
                return redirect()->route('link.expired')->with('error', 'You clicked an older link! Because you requested a new link recently, your email app grouped them together. Please scroll to the VERY BOTTOM of your email thread for the newest, valid link.');
            }

            // Standard expiration message if no token exists in the database at all
            return redirect()->route('link.expired')->with('error', 'This setup link is invalid or has expired. Please contact IT support for a new one.');
        }

        // 3. Prevent already-active users from accessing this page
        if ($user->status === 'Active') {
             return redirect()->route('login')->with('status', 'Your account is already active. Please log in.');
        }

        // 4. Send the user to the React setup page
        return Inertia::render('Auth/SetupAccount', [
            'email' => $email,
            'token' => $token,
        ]);
    }

    public function setupPassword(Request $request)
    {
        $request->validate([
            'token' => 'required',
            'email' => 'required|email',
            'password' => 'required|min:8|confirmed',
        ]);

        $status = Password::broker()->reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function ($user, $password) {
                $user->password = Hash::make($password);
                
                // 🟢 Safety catch: Guarantee the red badge is cleared
                $user->status = 'Active'; 
                $user->save();
                
                event(new PasswordReset($user));

                // 🟢 NEW: Notify the Admin team (Wrapped in try/catch to prevent 500 errors!)
                try {
                    $admins = User::whereHas('role', function ($q) {
                        $q->where('name', 'Admin');
                    })->get();

                    if ($admins->isNotEmpty()) {
                        Notification::send($admins, new PasswordResetSuccess($user));
                    }
                } catch (\Throwable $e) {
                    // If the email fails (or the class is missing), it won't crash the user's screen!
                    \Illuminate\Support\Facades\Log::error('Failed to send admin notification: ' . $e->getMessage());
                }
            }
        );

        if ($status === Password::PASSWORD_RESET) {
            return redirect()->route('login')->with('success', 'Password set successfully! You may now log in.');
        }   

        return back()->withErrors(['email' => __($status)]);
    }
}