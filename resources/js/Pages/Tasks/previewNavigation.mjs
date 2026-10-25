// Keep the current screen when changing preview scope, mapping only role-specific destinations.
export function previewView(view, role, intern = false) {
    if (view === 'Daily Reports' && !['EVP', 'Team Leader'].includes(role)) return role === 'Employee' ? 'Daily Tasks' : 'My Tasks';
    if (role === 'Employee') {
        if (['Team Tasks', 'Team Progress'].includes(view)) return 'My Tasks';
        if (view === 'Review Queue') return 'Submissions';
        if (view === 'Weekly Reports' && !intern) return 'My Tasks';
    } else {
        if (view === 'Submissions') return 'Review Queue';
    }
    return view;
}
