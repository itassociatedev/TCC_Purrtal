<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use App\Models\OrgChartMember;

class DevelopmentAccountSwitcherController extends Controller
{
    private function authorizeSwitcher(Request $request): void
    {
        abort_unless(
            app()->environment(['local', 'testing'])
            && ($request->user()?->email === config('app.dev_switcher_email', env('DEV_ACCOUNT_SWITCHER_EMAIL', 'itassociate@catclinic.ph'))
                || $request->session()->has('dev_switcher_original_user_id')),
            404
        );
    }

    public function users(Request $request)
    {
        $this->authorizeSwitcher($request);
        $search = trim((string) $request->query('search', ''));

        $directoryMembers = OrgChartMember::query()->get(['name', 'position', 'branch']);
        $normalize = static fn ($value) => trim((string) preg_replace('/[^a-z0-9]+/i', ' ', strtolower((string) $value)));
        $directoryForUser = static function (User $user) use ($directoryMembers, $normalize) {
            $userName = $normalize($user->name);
            $userParts = array_values(array_filter(explode(' ', $userName)));
            $userFirst = $userParts[0] ?? '';
            $userLast = $userParts[count($userParts) - 1] ?? '';
            return $directoryMembers->first(function ($member) use ($normalize, $userName, $userFirst, $userLast) {
                $memberName = $normalize($member->name);
                if ($memberName === $userName || str_contains($memberName, $userName) || str_contains($userName, $memberName)) return true;
                $parts = array_values(array_filter(explode(' ', $memberName)));
                $memberFirst = $parts[0] ?? '';
                $memberTokens = array_slice($parts, 1);
                return $userFirst !== ''
                    && $userLast !== ''
                    && $memberFirst === $userFirst
                    && in_array($userLast, $memberTokens, true);
            });
        };

        $users = User::with(['role:id,name', 'department:id,name', 'position:id,name', 'branch:id,name'])
            ->when($search !== '', function ($query) use ($search) {
                $term = '%' . $search . '%';
                $query->where(function ($nested) use ($term) {
                    $nested->where('name', 'like', $term)
                        ->orWhere('email', 'like', $term)
                        ->orWhereHas('department', fn ($q) => $q->where('name', 'like', $term))
                        ->orWhereHas('position', fn ($q) => $q->where('name', 'like', $term))
                        ->orWhereHas('branch', fn ($q) => $q->where('name', 'like', $term));
                });
            })
            ->orderBy('name')
            ->get(['id', 'name', 'email', 'role_id', 'department_id', 'position_id', 'branch_id'])
            ->map(function (User $user) use ($directoryForUser) {
                $directoryMember = $directoryForUser($user);
                $user->setAttribute('directory_position', $directoryMember?->position);
                $user->setAttribute('directory_branch', $directoryMember?->branch);
                return $user;
            });

        return response()->json(['data' => $users]);
    }

    public function switch(Request $request, User $target)
    {
        $this->authorizeSwitcher($request);
        if (!$request->session()->has('dev_switcher_original_user_id')) {
            $request->session()->put('dev_switcher_original_user_id', $request->user()->id);
        }

        Auth::login($target);
        $request->session()->regenerate();

        return back()->with('success', 'Development account switched to ' . $target->name . '.');
    }

    public function restore(Request $request)
    {
        $this->authorizeSwitcher($request);
        $originalId = $request->session()->pull('dev_switcher_original_user_id');
        abort_unless($originalId, 404);

        Auth::loginUsingId($originalId);
        $request->session()->regenerate();

        return back()->with('success', 'Returned to the development account.');
    }
}
