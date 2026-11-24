// The server capability is mandatory; a preview can restrict it but can never grant it.
export function canUseTaskLeaderboard(serverAllowed, role, position = '') {
    return serverAllowed === true && role !== 'Employee' && !/intern/i.test(position);
}
