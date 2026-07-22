# ACL Permission Hierarchy - Official Implementation

**Version:** 2.0 (Simplified & Clear)  
**Date:** 2026-06-26  
**Status:** ✅ IMPLEMENTED & ENFORCED

---

## 🔐 Permission Hierarchy Overview

The ACL system now follows a **crystal-clear permission hierarchy** with four distinct levels:

### Level 1: **FULL** = Create / Edit / Delete / Admin
**Capabilities:**
- ✅ CREATE - Can submit/create new items
- ✅ EDIT - Can modify existing items
- ✅ DELETE - Can remove items
- ✅ ADMIN - Can perform admin functions
- ✅ APPROVE - Can approve requests
- ✅ REJECT - Can reject requests
- ✅ VIEW - Can view all data

**Use Cases:** Admins, Directors, Module Managers, Full Access Roles

---

### Level 2: **EDIT** = Create / Approve / Reject (NO Delete)
**Capabilities:**
- ✅ CREATE - Can submit/create new items
- ✅ APPROVE - Can approve pending requests
- ✅ REJECT - Can reject requests with notes
- ✅ VIEW - Can view all data
- ❌ **NOT** EDIT - Cannot modify existing items
- ❌ **NOT** DELETE - Cannot remove items
- ❌ **NOT** ADMIN - Cannot perform admin functions

**Use Cases:** Approvers, Team Leads, Operations Managers, Approval Board Members

---

### Level 3: **VIEW** = Request and View Only
**Capabilities:**
- ✅ VIEW - Can view/read all data
- ✅ REQUEST - Can submit requests/forms
- ❌ **NOT** CREATE (edit) - Cannot modify existing items
- ❌ **NOT** APPROVE - Cannot approve requests
- ❌ **NOT** REJECT - Cannot reject requests
- ❌ **NOT** DELETE - Cannot remove items
- ❌ **NOT** ADMIN - Cannot perform admin functions

**Use Cases:** End Users, Requesters, Read-Only Staff, Auditors (View-Only)

---

### Level 4: **NONE** = No Access
**Capabilities:**
- ❌ No access to module at all
- ❌ Cannot view, create, edit, delete, or admin
- ❌ Cannot see menu items for this module
- ❌ Routes return 403 Forbidden

**Use Cases:** Users without any role in this module

---

## 📋 Backend Permission Methods (User Model)

```php
// User.php - New Permission Methods Following Clear Hierarchy

$user->canViewModule('module_name')      // Returns: Full, Edit, View → true
$user->canCreateModule('module_name')    // Returns: Full, Edit → true
$user->canEditModule('module_name')      // Returns: Full only → true
$user->canApproveModule('module_name')   // Returns: Full, Edit → true
$user->canRejectModule('module_name')    // Returns: Full, Edit → true
$user->canDeleteModule('module_name')    // Returns: Full only → true
$user->canAdminModule('module_name')     // Returns: Full only → true
```

### Example Usage:

```php
// Creating a new product - requires CREATE permission
if (!$user->canCreateModule('products')) {
    abort(403, 'You do not have permission to add products.');
}

// Editing an existing product - requires EDIT permission (Full only)
if (!$user->canEditModule('products')) {
    abort(403, 'You do not have permission to update products.');
}

// Deleting a product - requires DELETE permission (Full only)
if (!$user->canDeleteModule('products')) {
    abort(403, 'You do not have permission to delete products.');
}

// Approving a request - requires APPROVE permission
if (!$user->canApproveModule('purchase_requests')) {
    abort(403, 'You do not have permission to approve requests.');
}
```

---

## 🎨 Frontend Permission Helpers (navigation.jsx)

```javascript
// New Permission Helpers Following Clear Hierarchy

canViewModule(auth, 'module_key')        // Full, Edit, View → true
canCreateModule(auth, 'module_key')      // Full, Edit → true
canEditModule(auth, 'module_key')        // Full only → true
canApproveModule(auth, 'module_key')     // Full, Edit → true
canRejectModule(auth, 'module_key')      // Full, Edit → true
canDeleteModule(auth, 'module_key')      // Full only → true
canAdminModule(auth, 'module_key')       // Full only → true
```

### Example Usage:

```jsx
// Conditionally render buttons based on permissions

// Create button - show for Full or Edit
{canCreateModule(auth, 'products') && (
  <button onClick={handleCreate}>Add Product</button>
)}

// Edit button - show for Full only
{canEditModule(auth, 'products') && (
  <button onClick={handleEdit}>Edit Product</button>
)}

// Delete button - show for Full only
{canDeleteModule(auth, 'products') && (
  <button onClick={handleDelete}>Delete Product</button>
)}

// Approve button - show for Full or Edit
{canApproveModule(auth, 'purchase_requests') && (
  <button onClick={handleApprove}>Approve</button>
)}
```

---

## 📊 Permission Matrix

| Action | Full | Edit | View | None |
|--------|------|------|------|------|
| **VIEW** | ✅ | ✅ | ✅ | ❌ |
| **CREATE** | ✅ | ✅ | ❌ | ❌ |
| **EDIT** | ✅ | ❌ | ❌ | ❌ |
| **DELETE** | ✅ | ❌ | ❌ | ❌ |
| **APPROVE** | ✅ | ✅ | ❌ | ❌ |
| **REJECT** | ✅ | ✅ | ❌ | ❌ |
| **ADMIN** | ✅ | ❌ | ❌ | ❌ |

---

## 🔄 Permission Flow by Module

### **Products Module** (`products`)

| Role | Permission | Can Create | Can Edit | Can Delete | Can Approve |
|------|-----------|-----------|----------|-----------|------------|
| Admin | Full | ✅ | ✅ | ✅ | N/A |
| Procurement TL | Full | ✅ | ✅ | ✅ | N/A |
| Procurement Asst | Edit | ✅ | ❌ | ❌ | N/A |
| End User | View | ❌ | ❌ | ❌ | N/A |

**Controllers Using This:**
- `ProductController::store()` → checks `canCreateModule('products')`
- `ProductController::update()` → checks `canEditModule('products')`
- `ProductController::destroy()` → checks `canDeleteModule('products')`

---

### **Purchase Requests Module** (`purchase_requests`)

| Role | Permission | Can Create | Can Approve | Can Reject | Can Edit |
|------|-----------|-----------|-----------|-----------|---------|
| Admin | Full | ✅ | ✅ | ✅ | ✅ |
| Ops Manager | Edit | ✅ | ✅ | ✅ | ❌ |
| Inventory TL | Full | ✅ | ✅ | ✅ | ✅ |
| Inventory Asst | Edit | ✅ | ✅ | ✅ | ❌ |
| End User | View | ❌ | ❌ | ❌ | ❌ |

**Controllers Using This:**
- `PurchaseRequestController::store()` → checks `canCreateModule('purchase_requests')`
- `PurchaseRequestController::update()` → checks `canEditModule('purchase_requests')`
- `PurchaseRequestController::updateStatus()` → checks `canApproveModule()` or `canRejectModule()`

---

### **Purchase Orders Module** (`purchase_orders`)

| Role | Permission | Can Create | Can Edit | Can Delete | Can Approve |
|------|-----------|-----------|----------|-----------|------------|
| Admin | Full | ✅ | ✅ | ✅ | N/A |
| Procurement TL | Full | ✅ | ✅ | ✅ | N/A |
| Procurement Asst | Edit | ✅ | ❌ | ❌ | N/A |

**Controllers Using This:**
- `PurchaseOrderController::generateFromPR()` → checks `canCreateModule('purchase_orders')`
- `PurchaseOrderController::update()` → checks `canEditModule('purchase_orders')`

---

### **Form 2316 Approvals Module** (`form_2316_approvals`)

| Role | Permission | Can Create | Can Approve | Can Reject | Can Admin |
|------|-----------|-----------|-----------|-----------|---------|
| Admin | Full | ✅ | ✅ | ✅ | ✅ |
| HRBP | Full | ✅ | ✅ | ✅ | ✅ |
| HR Approver | Edit | ✅ | ✅ | ✅ | ❌ |
| General Accounting | Edit | ✅ | ✅ | ✅ | ❌ |
| HR Staff | View | ❌ | ❌ | ❌ | ❌ |

**Controllers Using This:**
- `HrRequestController::updateStatus()` → checks `canApproveModule('form_2316_approvals')`
- `HrRequestController::updateAccountingStatus()` → checks `canApproveModule('form_2316_approvals')`

---

## 🛡️ Backend Controller Updates Summary

### **ProductController**
```php
store()        → canCreateModule('products')    // Full + Edit
update()       → canEditModule('products')      // Full only
destroy()      → canDeleteModule('products')    // Full only
batchDestroy() → canDeleteModule('products')    // Full only
toggleStatus() → canEditModule('products')      // Full only
```

### **SupplierController**
```php
store()        → canCreateModule('suppliers')    // Full + Edit
update()       → canEditModule('suppliers')      // Full only
destroy()      → canDeleteModule('suppliers')    // Full only
batchDestroy() → canDeleteModule('suppliers')    // Full only
toggleStatus() → canEditModule('suppliers')      // Full only
```

### **PurchaseRequestController**
```php
store()        → canCreateModule('purchase_requests')     // Full + Edit
update()       → canEditModule('purchase_requests')       // Full only
updateStatus() → canApproveModule() or canRejectModule()  // Full + Edit
```

### **PurchaseOrderController**
```php
generateFromPR() → canCreateModule('purchase_orders')     // Full + Edit
update()         → canEditModule('purchase_orders')       // Full only
```

### **HrRequestController**
```php
store()                 → canCreateModule('documents')            // Full + Edit
updateStatus()          → canApproveModule('form_2316_approvals') // Full + Edit
updateAccountingStatus() → canApproveModule('form_2316_approvals') // Full + Edit
```

---

## ✅ Verification Checklist

- [x] User model has all 7 permission methods
- [x] Navigation helpers have all 7 permission functions
- [x] AdminACL model documents the hierarchy
- [x] ProductController uses correct permission checks
- [x] SupplierController uses correct permission checks
- [x] PurchaseRequestController uses correct permission checks
- [x] PurchaseOrderController uses correct permission checks
- [x] HrRequestController uses correct permission checks
- [x] Backend permission checks are enforced
- [x] Frontend helpers are available
- [x] Documentation is complete

---

## 🚀 Migration from Old System

| Old Method | New Methods | Notes |
|-----------|-----------|-------|
| `canEditModule()` | Depends on action | **Breaking Change** - Now only for EDIT, not CREATE/DELETE |
| `canDeleteModule()` | `canDeleteModule()` | Same behavior - Full only |
| `hasPermission()` | `canAccessModule()` | Same behavior - checks not 'no_access' |

### Migration Path:
1. **CREATE operations** → Use `canCreateModule()` instead of old `canEditModule()`
2. **EDIT operations** → Use new `canEditModule()` for Full-only checking
3. **DELETE operations** → Use `canDeleteModule()` (unchanged behavior)
4. **APPROVE operations** → Use `canApproveModule()` (new method)
5. **REJECT operations** → Use `canRejectModule()` (new method)

---

## 📝 Example: Complete Workflow

### Scenario: Inventory Assistant creates a PR

```
Step 1: Create Permission Check
┌─────────────────────────────────────┐
│ canCreateModule('purchase_requests') │
│ "Edit" permission = ✅ CAN CREATE   │
└─────────────────────────────────────┘
          ↓ (PR Created)
          
Step 2: Ops Manager Review
┌─────────────────────────────────────┐
│ canViewModule('purchase_requests')   │
│ "Edit" permission = ✅ CAN VIEW     │
└─────────────────────────────────────┘
          ↓ (Checks data)
          
Step 3: Ops Manager Approves
┌─────────────────────────────────────┐
│ canApproveModule('purchase_requests')│
│ "Edit" permission = ✅ CAN APPROVE  │
└─────────────────────────────────────┘
          ↓ (PR Approved)
          
Step 4: Procurement TL Generates PO
┌─────────────────────────────────────┐
│ canCreateModule('purchase_orders')   │
│ "Full" permission = ✅ CAN CREATE   │
└─────────────────────────────────────┘
          ↓ (PO Created)
          
Step 5: Procurement TL Edits PO Details
┌─────────────────────────────────────┐
│ canEditModule('purchase_orders')     │
│ "Full" permission = ✅ CAN EDIT     │
└─────────────────────────────────────┘
          ↓ (PO Finalized)
          
End User Cannot:
- Edit PO (needs Full, only has View)
- Approve PR (needs Full or Edit, only has View)
- Delete any item (needs Full)
```

---

## 🎯 Best Practices

1. **Always check specific actions, not module access**
   - ❌ WRONG: `if ($user->hasPermission('products')) {}`
   - ✅ RIGHT: `if ($user->canDeleteModule('products')) {}`

2. **Use appropriate method for each operation**
   - CREATE → `canCreateModule()`
   - EDIT → `canEditModule()`
   - DELETE → `canDeleteModule()`
   - APPROVE → `canApproveModule()`

3. **Frontend AND Backend**
   - Always check both frontend (show/hide buttons) AND backend (abort 403)
   - Never trust frontend permission checks alone

4. **Three-Layer Defense**
   - Route Middleware: `admin_acl:module_name`
   - Controller Method: `$user->canSomeModule()`
   - Business Logic: Additional checks if needed

---

## 🔗 Related Documentation

- `ACL_PERMISSION_FIX_GUIDE.md` - Original ACL implementation
- `ACL_QUICK_REFERENCE.md` - Quick lookup guide
- `ACL_VIEWMODE_FIX_VERIFICATION.md` - Testing procedures
- `app/Models/User.php` - Backend permission methods
- `resources/js/Config/navigation.jsx` - Frontend helpers

---

## 📞 Support

For questions about permissions:
1. Check this document first
2. Review the permission matrix table
3. Look at controller examples in "Backend Controller Updates Summary"
4. Check the User model in `app/Models/User.php`
5. Contact the development team

---

**Last Updated:** 2026-06-26  
**Version:** 2.0 - Clear Hierarchy  
**Status:** ✅ Production Ready

