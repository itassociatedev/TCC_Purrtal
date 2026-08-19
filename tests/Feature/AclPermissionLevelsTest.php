<?php

use App\Models\AdminACL;
use App\Models\Role;
use App\Models\User;

beforeEach(function () {
    // Ensure the database is fresh for each run.
    $this->artisan('migrate:fresh');
});

test('full permission grants access, edit, and delete rights for a module', function () {
    $role = Role::create(['name' => 'Full Role']);
    $user = User::factory()->create(['role_id' => $role->id]);

    AdminACL::create([
        'role_id' => $role->id,
        'module' => 'documents',
        'permission_level' => 'full',
    ]);

    expect($user->aclPermissionForModule('documents'))->toBe('full');
    expect($user->canAccessModule('documents'))->toBeTrue();
    expect($user->canEditModule('documents'))->toBeTrue();
    expect($user->canDeleteModule('documents'))->toBeTrue();
});

test('edit permission grants access and edit but denies delete', function () {
    $role = Role::create(['name' => 'Edit Role']);
    $user = User::factory()->create(['role_id' => $role->id]);

    AdminACL::create([
        'role_id' => $role->id,
        'module' => 'documents',
        'permission_level' => 'edit',
    ]);

    expect($user->aclPermissionForModule('documents'))->toBe('edit');
    expect($user->canAccessModule('documents'))->toBeTrue();
    expect($user->canEditModule('documents'))->toBeTrue();
    expect($user->canDeleteModule('documents'))->toBeFalse();
    expect($user->canAccessModule('system_logs'))->toBeFalse();
});

test('view permission grants read-only access and denies edit, delete, and admin capabilities', function () {
    $role = Role::create(['name' => 'View Role']);
    $user = User::factory()->create(['role_id' => $role->id]);

    AdminACL::create([
        'role_id' => $role->id,
        'module' => 'documents',
        'permission_level' => 'view',
    ]);

    expect($user->aclPermissionForModule('documents'))->toBe('view');
    expect($user->canAccessModule('documents'))->toBeTrue();
    expect($user->canEditModule('documents'))->toBeFalse();
    expect($user->canDeleteModule('documents'))->toBeFalse();
    expect($user->canAccessModule('access_control'))->toBeFalse();
});

test('none permission blocks module access completely', function () {
    $role = Role::create(['name' => 'No Access Role']);
    $user = User::factory()->create(['role_id' => $role->id]);

    AdminACL::create([
        'role_id' => $role->id,
        'module' => 'documents',
        'permission_level' => 'no_access',
    ]);

    expect($user->aclPermissionForModule('documents'))->toBe('no_access');
    expect($user->canAccessModule('documents'))->toBeFalse();
    expect($user->canEditModule('documents'))->toBeFalse();
    expect($user->canDeleteModule('documents'))->toBeFalse();
});

test('superadmin role receives full access even without explicit ACL entries', function () {
    $role = Role::create(['name' => 'Admin']);
    $user = User::factory()->create(['role_id' => $role->id]);

    expect($user->aclPermissionForModule('system_logs'))->toBe('full');
    expect($user->canAccessModule('system_logs'))->toBeTrue();
    expect($user->canEditModule('system_logs'))->toBeTrue();
    expect($user->canDeleteModule('system_logs'))->toBeTrue();
});

test('permission lookups handle module names case-insensitively and trim whitespace', function () {
    $role = Role::create(['name' => 'Trim Role']);
    $user = User::factory()->create(['role_id' => $role->id]);

    AdminACL::create([
        'role_id' => $role->id,
        'module' => ' documents ',
        'permission_level' => 'edit',
    ]);

    expect($user->aclPermissionForModule('documents'))->toBe('edit');
    expect($user->aclPermissionForModule('  DocuMents  '))->toBe('edit');
});

test('role without any ACL entries is treated as no access for normal roles', function () {
    $role = Role::create(['name' => 'Empty Role']);
    $user = User::factory()->create(['role_id' => $role->id]);

    expect($user->aclPermissionForModule('documents'))->toBe('no_access');
    expect($user->canAccessModule('documents'))->toBeFalse();
});

test('admin protected route returns 401 for guests and 403 for users without access', function () {
    $this->get('/admin/access-control')
        ->assertStatus(401);

    $role = Role::create(['name' => 'No Access User']);
    $user = User::factory()->create(['role_id' => $role->id]);

    $response = $this->actingAs($user)->get('/admin/access-control');
    $response->assertStatus(403);
});

test('users with access_control permission can still reach the admin module landing page', function () {
    $role = Role::create(['name' => 'ACL Admin']);
    $user = User::factory()->create(['role_id' => $role->id]);

    AdminACL::create([
        'role_id' => $role->id,
        'module' => 'access_control',
        'permission_level' => 'full',
    ]);

    $this->actingAs($user)
        ->get('/admin/dashboard')
        ->assertStatus(200);
});

test('full access role can reach admin access control route', function () {
    $role = Role::create(['name' => 'Full Admin']);
    $user = User::factory()->create(['role_id' => $role->id]);

    AdminACL::create([
        'role_id' => $role->id,
        'module' => 'access_control',
        'permission_level' => 'full',
    ]);

    $this->actingAs($user)
        ->get('/admin/access-control')
        ->assertStatus(200);
});
