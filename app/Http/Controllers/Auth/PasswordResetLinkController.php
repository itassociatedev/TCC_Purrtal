<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Validation\ValidationException;
use App\Notifications\PasswordResetSuccess;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;
use Inertia\Inertia;

class PasswordResetLinkController extends Controller
{
    /**
     * Display the password reset link request view.
     */
    public function showResetForm(Request $request)
    {

        $email = $request->email;
        $token = $request->token;

        $user = User::where('email', $email)->first();

        if (!$user) {
            return redirect()->route('login')->with('error', 'Invalid request. Please contact IT support for assistance.');
        }

        $tokenRecord = DB::table('password_reset_tokens')
        ->where('email', $user->email)
        ->first();

        $isValid = $tokenRecord && 
               Hash::check($token, $tokenRecord->token) &&
               Carbon::parse($tokenRecord->created_at)->addMinutes(config('auth.passwords.users.expire', 60))->isFuture();

        if (!$isValid) {
            return redirect()->route('link.expired')->with('error', 'This setup link is invalid or has expired. Please contact IT support for assistance.');
        }

        return Inertia::render('Auth/ResetPassword', [
            'email' => $email,
            'token' => $token,
        ]);
    }

    /**
     * Handle an incoming password reset link request.
     *
     * @throws \Illuminate\Validation\ValidationException
     */
    public function resetPassword(Request $request)
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

                // Notify Admin and IT staff about successful password recovery.
                $admins = User::whereHas('role', function ($q) {
                    $q->where('name', 'Admin');
                })->orWhereHas('department', fn ($q) => $q->where('name', 'IT'))
                  ->orWhereHas('role', fn ($q) => $q->where('name', 'like', 'IT %'))
                  ->get();

                if ($admins->isNotEmpty()) {
                    Notification::send($admins, new PasswordResetSuccess($user));
                }
            }
        );

        if ($status === Password::PASSWORD_RESET) {
            return redirect()->route('login')->with('success', 'Password set successfully! You may now log in.');
        }   

        return back()->withErrors(['email' => __($status)]);
    }
}
