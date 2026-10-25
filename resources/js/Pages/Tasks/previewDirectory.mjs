const hierarchy=['EVP','Corporate Services','Operations Manager','Chief Vet','Team Leader','Employee'];
const compare=(a,b)=>String(a||'').localeCompare(String(b||''),undefined,{numeric:true,sensitivity:'base'});
export function sortPreviewRoles(roles) {
    const rank=role=>{const i=hierarchy.indexOf(role.name==='Corporate Services'?role.name:role.baseRole);return i<0?hierarchy.length:i;};
    return [...roles].sort((a,b)=>rank(a)-rank(b)||compare(a.name,b.name));
}
export function sortPreviewPeople(people) {
    return [...people].sort((a,b)=>compare(a.department,b.department)||compare(a.position,b.position)||compare(a.branch,b.branch)||compare(a.name,b.name));
}
export function groupPreviewPeople(people) {
    const groups=new Map();
    for(const person of sortPreviewPeople(people)){
        const department=person.department||'Other';
        if(!groups.has(department))groups.set(department,[]);
        groups.get(department).push(person);
    }
    return [...groups].map(([department,people])=>({department,people}));
}
export function previewMember(members,name,branch) {
    return members.find(person=>person.name===name)||members.find(person=>person.branch===branch)||members[0];
}
