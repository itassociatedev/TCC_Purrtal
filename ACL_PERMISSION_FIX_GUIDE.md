# ACL Permission Caching - Complete Fix Guide

## Issues Found & Resolved

### 🔴 **PRIMARY ISSUE: Hardcoded Role Checks**

**Problem:** Menu items were checking user's role NAME instead of their actual ACL permissions.

**Example (Before Fix):**
```javascript
// ❌ BAD: Only shows menu if role name is exactly 'admin' or 'hrbp'
if (isAdmin || isHRBP || isRequesterOnly || isApprover) {
    links.push({
        label: 'Manpower Request Form',
        href: route('hr.manpower-requests.create'),
    });
}
```

**Issue Caused:** Even after updating the ACL table to grant 'manpower_requests_form' permission to a new role, the menu wouldn't show because the code was checking for hardcoded role names, NOT the permission array.

**Fix Applied:**
```javascript
// ✅ GOOD: Checks the dynamic permissions array
const canCreateManpowerRequest = hasPermission(auth, 'manpower_requests_form');
if (canCreateManpowerRequest) {
    links.push({
        label: 'Manpower Request Form',
        href: route('hr.manpower-requests.create'),
    });
}
```

### Files Fixed:
1. **`resources/js/Config/navigation.jsx`**
   - `getHRLinks()` - Fixed Manpower Request Form & Approval Board menu items
   - `getPRPOLinks()` - Fixed all PR/PO menu items (PR Form, Approval Board, PO Generation, Products, Suppliers)
   - `getDutyMealLinks()` - Fixed Set Up Roster & Archive menu items

---

## 🟡 **SECONDARY ISSUE: Session/Permission Caching**

### Problem
After admin updates ACL permissions in the database, users don't immediately see the changes. They need to:
- Log out and log back in, OR
- Manually refresh the page several times, OR
- Clear browser cache

### Root Cause
1. **Backend:** Permissions are loaded fresh on each request ✅ (HandleInertiaRequests does this)
2. **Frontend:** Inertia.js might cache shared props in React memory
3. **Browser:** HTTP caching might serve old versions

### Solution Implemented

#### Option 1: Automatic (Recommended)
Each new page request automatically loads fresh permissions because HandleInertiaRequests middleware calls:
```php
$user->load(['role', 'role.adminAcls', ...])  // Fresh from DB
```

**However**, if the user stays on the same page, React won't re-render with new permissions.

#### Option 2: Manual Refresh (New Feature)

Added two new endpoints:

```
POST /permissions/refresh          → Reload permissions, stay on current page
POST /permissions/clear-session-cache → Nuclear option: clear entire session
```

**Usage in UI:**
```javascript
// Somewhere in your component (e.g., Settings or Admin Dashboard)
const refreshPermissions = () => {
    axios.post(route('permissions.refresh')).then(() => {
        // Page reloads automatically (since Inertia handles it)
        window.location.reload();
    });
};
```

**Or in a button:**
```jsx
<button 
    onClick={() => axios.post(route('permissions.refresh')).then(() => window.location.reload())}
>
    Refresh Permissions
</button>
```

---

## 📋 **Module Names Verification** ✅

All module names match between config and frontend:

| Module Key | Config | Navigation | ACL Check |
|-----------|--------|-----------|-----------|
| `manpower_requests_form` | ✅ | ✅ | `hasPermission(auth, 'manpower_requests_form')` |
| `approval_board_hr` | ✅ | ✅ | `hasPermission(auth, 'approval_board_hr')` |
| `feedback_form` | ✅ | ✅ | `hasPermission(auth, 'feedback_form')` |
| `purchase_requests` | ✅ | ✅ | `hasPermission(auth, 'purchase_requests')` |
| `approval_board` | ✅ | ✅ | `hasPermission(auth, 'approval_board')` |
| `purchase_orders` | ✅ | ✅ | `hasPermission(auth, 'purchase_orders')` |
| `products` | ✅ | ✅ | `hasPermission(auth, 'products')` |
| `suppliers` | ✅ | ✅ | `hasPermission(auth, 'suppliers')` |
| `duty_meal_setup_roster` | ✅ | ✅ | `hasPermission(auth, 'duty_meal_setup_roster')` |
| `duty_meal_archive` | ✅ | ✅ | `hasPermission(auth, 'duty_meal_archive')` |

---

## 🔐 **How ACL Permission Flow Works (After Fixes)**

### 1. **Admin updates ACL in database**
```sql
UPDATE admin_acls 
SET permission_level = 'edit' 
WHERE role_id = 5 AND module = 'manpower_requests_form';
```

### 2. **User makes next request (any navigation)**
- Inertia middleware intercepts request
- Calls `HandleInertiaRequests->share()`
- Loads `$user->load(['role', 'role.adminAcls'])`  ← Fresh from DB!
- Calls `getPermissionStrings()` which queries admin_acls table
- Filters out 'no_access' entries
- Sends `auth.user.permissions` array to React with new permission

### 3. **React component renders menu**
- Calls `hasPermission(auth, 'manpower_requests_form')`
- Checks if module name is IN the permissions array
- Shows menu item if permission exists
- Menu item is now VISIBLE because permission array now includes the module!

---

## ✅ **Testing the Fix**

### Step 1: Give a user new permission
```sql
INSERT INTO admin_acls (role_id, module, permission_level) 
VALUES (5, 'manpower_requests_form', 'full');

-- Or update existing
UPDATE admin_acls 
SET permission_level = 'edit' 
WHERE role_id = 5 AND module = 'manpower_requests_form';
```

### Step 2: User navigates to any page
The menu item should now appear because:
- Fresh permissions are loaded from DB
- Frontend checks the new permissions array
- Menu renders dynamically

### Step 3: Test without navigation
If user is on same page and permissions still don't show:
- Use the new refresh endpoint: `POST /permissions/refresh`
- Or manually call: `axios.post(route('permissions.refresh'))`
- Or user can click Settings → Refresh Permissions (if you add the button)

---

## 🎯 **Best Practices Going Forward**

1. **Always use `hasPermission()` function** for frontend checks
   ```javascript
   // ✅ DO THIS
   if (hasPermission(auth, 'module_key')) {
       // Show menu item
   }
   ```

2. **Never hardcode role names** for access control
   ```javascript
   // ❌ NEVER DO THIS
   if (role === 'admin' || role === 'hrbp') {
       // This won't pick up new ACL changes!
   }
   ```

3. **Backend always validates permissions** with `canEditModule()`
   ```php
   // ✅ Backend always checks (cannot be bypassed from frontend)
   if (!$user->canEditModule('documents')) {
       abort(403);
   }
   ```

4. **Use exact module names** from `config/admin-acl.php`
   - Names are lowercase with underscores
   - Examples: `manpower_requests_form`, `duty_meal_setup_roster`

---

## 📞 **Troubleshooting**

### Q: Menu item still doesn't show after updating ACL
**A:** 
1. Clear browser cache (Ctrl+Shift+Delete)
2. User navigates to a different page
3. Use refresh endpoint: `axios.post(route('permissions.refresh'))`
4. If still not working, verify in database:
   ```sql
   SELECT * FROM admin_acls 
   WHERE role_id = ? AND module = ?;
   ```

### Q: User can see menu but gets 403 when clicking
**A:** This is correct! Frontend doesn't have complete ACL data (performance). Backend validates all actions.

### Q: How to add Refresh button to UI
**A:**
```jsx
// In your component
const handleRefreshPermissions = () => {
    axios.post(route('permissions.refresh'))
        .then(() => window.location.reload())
        .catch(() => alert('Failed to refresh permissions'));
};

return (
    <button onClick={handleRefreshPermissions}>
        Refresh Permissions
    </button>
);
```

---

## 📊 **Summary of Changes**

| Component | Before | After |
|-----------|--------|-------|
| `getHRLinks()` | Hardcoded role checks | Dynamic permission checks via `hasPermission()` |
| `getPRPOLinks()` | Hardcoded role checks | Dynamic permission checks via `hasPermission()` |
| `getDutyMealLinks()` | Hardcoded `isAuditor` check | Dynamic `hasPermission('duty_meal_setup_roster')` |
| Permission Refresh | None | New endpoints added |
| Database ACL Updates | Required logout | User can use refresh endpoint |

---

## 🚀 **Next Steps**

1. **Test the fixes** by updating ACL and verifying menu items appear
2. **Add Refresh Permissions button** to Settings page (optional)
3. **Train admins** to always use database module names (exact case + underscores)
4. **Monitor for issues** - if users report permission glitches, check browser cache first
