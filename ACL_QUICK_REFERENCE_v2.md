# ACL Permission System - Quick Reference Card

**Print this for your desk!** 🖨️

---

## 🔐 Permission Levels

```
┌─────────────┬────────────────────────────┐
│   LEVEL     │      CAPABILITIES          │
├─────────────┼────────────────────────────┤
│ FULL        │ Create/Edit/Delete/Admin   │
│ EDIT        │ Create/Approve/Reject      │
│ VIEW        │ Request & View Only        │
│ NONE        │ No Access                  │
└─────────────┴────────────────────────────┘
```

---

## 🛠️ Backend Methods (User Model)

```php
$user->canViewModule($module)       // Full, Edit, View
$user->canCreateModule($module)     // Full, Edit
$user->canEditModule($module)       // Full ONLY
$user->canApproveModule($module)    // Full, Edit
$user->canRejectModule($module)     // Full, Edit
$user->canDeleteModule($module)     // Full ONLY
$user->canAdminModule($module)      // Full ONLY
```

### Examples:
```php
// Check BEFORE performing action
if (!$user->canDeleteModule('products')) {
    abort(403, 'Permission denied');
}
```

---

## 🎨 Frontend Methods (navigation.jsx)

```javascript
canViewModule(auth, 'module_key')       // Full, Edit, View
canCreateModule(auth, 'module_key')     // Full, Edit
canEditModule(auth, 'module_key')       // Full ONLY
canApproveModule(auth, 'module_key')    // Full, Edit
canRejectModule(auth, 'module_key')     // Full, Edit
canDeleteModule(auth, 'module_key')     // Full ONLY
canAdminModule(auth, 'module_key')      // Full ONLY
```

### Examples:
```jsx
{canEditModule(auth, 'products') && <EditButton />}
{canDeleteModule(auth, 'products') && <DeleteButton />}
{canApproveModule(auth, 'purchase_requests') && <ApproveButton />}
```

---

## ✅ Permission Matrix

```
┌──────────┬─────┬──────┬──────┬──────┐
│ Action   │Full │Edit  │View  │None  │
├──────────┼─────┼──────┼──────┼──────┤
│ VIEW     │ ✅  │ ✅   │ ✅   │ ❌   │
│ CREATE   │ ✅  │ ✅   │ ❌   │ ❌   │
│ EDIT     │ ✅  │ ❌   │ ❌   │ ❌   │
│ DELETE   │ ✅  │ ❌   │ ❌   │ ❌   │
│ APPROVE  │ ✅  │ ✅   │ ❌   │ ❌   │
│ REJECT   │ ✅  │ ✅   │ ❌   │ ❌   │
│ ADMIN    │ ✅  │ ❌   │ ❌   │ ❌   │
└──────────┴─────┴──────┴──────┴──────┘
```

---

## 📋 Controller Patterns

### Creating
```php
// Check CREATE permission (Full + Edit)
if (!$user->canCreateModule('products')) {
    abort(403, 'Cannot create');
}
```

### Editing
```php
// Check EDIT permission (Full only)
if (!$user->canEditModule('products')) {
    abort(403, 'Cannot edit');
}
```

### Deleting
```php
// Check DELETE permission (Full only)
if (!$user->canDeleteModule('products')) {
    abort(403, 'Cannot delete');
}
```

### Approving
```php
// Check APPROVE permission (Full + Edit)
if (!$user->canApproveModule('purchase_requests')) {
    abort(403, 'Cannot approve');
}
```

### Rejecting
```php
// Check REJECT permission (Full + Edit)
if (!$user->canRejectModule('purchase_requests')) {
    abort(403, 'Cannot reject');
}
```

---

## 📦 Modules List

| Module Key | Module Name |
|-----------|-------------|
| `admin_overview` | Admin Overview |
| `announcements` | Announcements |
| `employees` | Employee Management |
| `documents` | Document Requests |
| `form_2316_approvals` | Form 2316 Approvals |
| `products` | Products Masterlist |
| `suppliers` | Supplier Management |
| `purchase_requests` | Purchase Requests |
| `purchase_orders` | Purchase Orders |
| `approval_board` | PRPO Approval Board |
| `approval_board_hr` | HR Approval Board |
| `duty_meal` | Duty Meal Management |

---

## 🔄 Common Workflows

### Product Management
- **ADD** → `canCreateModule('products')` → Full, Edit
- **EDIT** → `canEditModule('products')` → Full ONLY
- **DELETE** → `canDeleteModule('products')` → Full ONLY

### Purchase Request Workflow
- **SUBMIT** → `canCreateModule('purchase_requests')` → Full, Edit
- **APPROVE** → `canApproveModule('purchase_requests')` → Full, Edit
- **REJECT** → `canRejectModule('purchase_requests')` → Full, Edit
- **EDIT** → `canEditModule('purchase_requests')` → Full ONLY

### Approval Workflow
- **VIEW** → `canViewModule('form_2316_approvals')` → Full, Edit, View
- **APPROVE** → `canApproveModule('form_2316_approvals')` → Full, Edit
- **MANAGE** → `canAdminModule('form_2316_approvals')` → Full ONLY

---

## 🚨 Common Mistakes

### ❌ WRONG
```php
// Old system - no longer works this way
if ($user->canEditModule('products')) {
    // This is now only for EDITING, not CREATING!
}
```

### ✅ CORRECT
```php
// Use specific method for your action
if ($user->canCreateModule('products')) {  // For CREATING
if ($user->canEditModule('products')) {    // For EDITING
if ($user->canDeleteModule('products')) {  // For DELETING
```

---

## 🔍 Permission Lookup

**"Can users with `__` permission perform `__`?"**

| Can... | with Full? | with Edit? | with View? |
|--------|-----------|----------|----------|
| Create | ✅ | ✅ | ❌ |
| Approve | ✅ | ✅ | ❌ |
| Reject | ✅ | ✅ | ❌ |
| Edit | ✅ | ❌ | ❌ |
| Delete | ✅ | ❌ | ❌ |
| Admin | ✅ | ❌ | ❌ |
| View | ✅ | ✅ | ✅ |

---

## 🎯 Role-Permission Examples

### Admin Role
```
All Modules: FULL
├─ Can create, edit, delete, admin all modules
└─ Can approve/reject all requests
```

### Operations Manager Role
```
purchase_requests: EDIT
├─ Can create and approve/reject PRs
└─ CANNOT edit existing PRs
products: VIEW
└─ Can view only, no create/edit/delete
```

### Procurement Assistant Role
```
purchase_requests: EDIT
├─ Can create PRs
├─ Can approve/reject PRs
└─ CANNOT edit existing PRs
products: FULL
├─ Can create, edit, delete products
└─ Can manage all product functions
```

### End User Role
```
purchase_requests: VIEW
├─ Can view own PRs
├─ Can submit new PRs
└─ CANNOT approve/reject/edit
products: VIEW
└─ Can view products only
```

---

## 🔐 Security Layers

All actions are protected by **3 layers**:

```
1. Route Middleware: admin_acl:module_name
        ↓
2. Controller Check: $user->canSomeModule()
        ↓
3. Business Logic: Additional validations
```

**Never skip any layer!**

---

## 📊 Database Schema

```sql
-- admin_acl table
┌─────────────┬──────────────────────┬─────────────┐
│ role_id     │ module               │ permission_ │
│             │                      │ level       │
├─────────────┼──────────────────────┼─────────────┤
│ 1 (admin)   │ products             │ full        │
│ 2 (tl)      │ products             │ full        │
│ 3 (asst)    │ products             │ edit        │
│ 4 (user)    │ products             │ view        │
│ 5 (nobody)  │ products             │ no_access   │
└─────────────┴──────────────────────┴─────────────┘
```

---

## 💡 Tips

1. **Always check permission BEFORE action**
   - Check on button click (frontend)
   - Check in controller (backend)

2. **Use the most specific method**
   - Not: `canViewModule()` for create checks
   - Use: `canCreateModule()`

3. **Test all permission levels**
   - Test with Full permission user
   - Test with Edit permission user
   - Test with View permission user
   - Test with No Access user

4. **Debug permission issues**
   ```php
   $level = $user->aclPermissionForModule('products');
   // Returns: 'full', 'edit', 'view', or 'no_access'
   ```

---

## 📞 Quick Help

**"I want to add a button that only admins can see"**
```jsx
{canAdminModule(auth, 'products') && <AdminButton />}
```

**"I want to prevent non-admin deletion"**
```php
if (!$user->canDeleteModule('products')) {
    abort(403, 'Only administrators can delete products');
}
```

**"I want to allow creating but not editing"**
```php
store()  → canCreateModule('products')  // ✅ Full + Edit
update() → canEditModule('products')    // ✅ Full only
```

---

**Version:** 2.0  
**Last Updated:** 2026-06-26  
**Status:** ✅ Production Ready

