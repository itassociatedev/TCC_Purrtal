<?php

namespace App\Services;

use App\Models\TaskModuleRecord;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

class TaskModuleAccess
{
    public function role(User $user): string
    {
        $title = strtolower(trim($user->position?->name ?? ''));
        if (strtolower(trim($user->role?->name ?? '')) === 'admin') return 'Admin';
        return match (true) {
            (bool) preg_match('/executive vice president|^evp$/', $title) => 'EVP',
            (bool) preg_match('/operations? manager/', $title) => 'Operations Manager',
            (bool) preg_match('/hr manager|human resources business partner|internal auditor|coordination lead|marketing manager/', $title) => 'Corporate Services',
            (bool) preg_match('/chief veterinar/', $title) => 'Chief Vet',
            (bool) preg_match('/team leader|\btl\b|\bsupervisor\b/', $title) => 'Team Leader',
            default => 'Employee',
        };
    }
    public function department(User $user): string
    {
        $name = $user->department?->name ?? '';
        $rules = ['/^it$|information technology/i'=>'IT','/procurement/i'=>'Procurement','/inventory/i'=>'Inventory','/audit/i'=>'Internal Audit','/operations.*finance/i'=>'Operations & Finance','/finance|accounting/i'=>'Accounting','/human resources|^hr$/i'=>'HR','/marketing|sales/i'=>'Sales & Marketing','/technician|vet tech/i'=>'Vet Tech','/veterinar/i'=>'Veterinary','/clinic assistant|groomer/i'=>'Clinic Assistant','/front desk|reception/i'=>'Reception','/cashier|billing/i'=>'Cashier','/security/i'=>'Security','/driver|housekeeping|facilities|utility/i'=>'Facilities','/operations? manager|executive assistant|^operations$/i'=>'Clinic Operations Manager'];
        foreach ([$user->position?->name ?? '', $name] as $source) { foreach ($rules as $pattern => $department) if (preg_match($pattern, $source)) return $department; }
        return $name;
    }
    public function active(User $user): bool
    {
        return !preg_match('/disabled|inactive|terminated/i', $user->status ?? '') && (int) $user->id !== 380;
    }
    public function branches(User $user): array
    {
        return array_values(array_unique(array_filter([$user->branch?->name, ...$user->branches->pluck('name')->all()])));
    }
    public function visible(User $user): Builder
    {
        $query = TaskModuleRecord::query();
        $role = $this->role($user);
        if ($role==='Admin') return $query;
        if ($role==='EVP') {
            $directReports=User::with(['position','role'])->get()->filter(fn($person)=>$this->active($person)&&in_array($this->role($person),['Operations Manager','Corporate Services','Team Leader']))->pluck('id')->push($user->id);
            return $query->where(fn($q)=>$q->whereIn('assignee_id',$directReports)->orWhere('payload->handover->recipientId',$user->id));
        }
        if ($role === 'Corporate Services') {
            $teamIds = User::with(['position','department','branch','branches','role'])->get()
                ->filter(fn ($person) => $this->active($person) && $this->canAssign($user, $person))
                ->pluck('id')->push($user->id);
            return $query->where(function ($query) use ($teamIds, $user) {
                $query->whereIn('assignee_id', $teamIds)
                    ->orWhere('reviewer_id', $user->id)
                    ->orWhere('payload->handover->recipientId', $user->id)
                    ->orWhere('payload->handover->from', $user->name);
            })->where(function ($query) use ($user) {
                $query->where('payload->template', '!=', 'intern-weekly-report')->orWhere('assignee_id', $user->id);
            });
        }
        return $query->where(function ($query) use ($user, $role) {
            $query->where('payload->handover->recipientId',$user->id)->orWhere('payload->handover->from',$user->name)->orWhere('creator_id', $user->id)->orWhere('assignee_id', $user->id)->orWhere('reviewer_id', $user->id);
            if ($role === 'Team Leader') $query->orWhere('department', $this->department($user));
            if (in_array($role, ['Operations Manager','Chief Vet'])) $query->orWhere('branch', $user->branch?->name);
            if ($this->department($user) === 'IT') $query->orWhere(function ($shared) { $shared->where('department','IT')->whereNull('assignee_id'); });
        })->where(function ($query) use ($role, $user) {
            if ($role === 'Team Leader' && $this->department($user) === 'IT') return;
            $query->where('payload->template','!=','intern-weekly-report')->orWhere('assignee_id',$user->id);
        });
    }
    public function canDelete(User $actor,TaskModuleRecord $record): bool
    {
        $task=$record->payload;
        if (in_array($task['recurrence'] ?? '',['daily','weekly','monthly']) || ($task['template'] ?? '')==='intern-weekly-report') return false;
        $role=$this->role($actor);
        if (in_array($role,['Admin','EVP','Corporate Services'])) return true;
        if ($role==='Team Leader') return $record->assignee_id===$actor->id || in_array($this->department($actor),[$record->department,$task['originDepartment'] ?? null]);
        if ($role==='Operations Manager') return $record->assignee_id===$actor->id || in_array($actor->branch?->name,[$record->branch,$task['originBranch'] ?? null]);
        $parent=empty($task['parentId'])?null:TaskModuleRecord::where('client_key','task:'.$task['parentId'])->first();
        return $parent && $parent->assignee_id===$actor->id && in_array($parent->payload['status'],['Not Started','In Progress','Revision Needed']);
    }
    public function canAssign(User $actor, User $recipient, bool $collaborative = false, string $workCategory = ''): bool
    {
        $role = $this->role($actor);
        if ($role === 'Admin') return true;
        if ($actor->id === $recipient->id) return $role !== 'Employee' || $this->utility($actor);
        $target = $this->role($recipient);
        if ($collaborative && $role === 'Operations Manager' && $target === 'Operations Manager') return true;
        $department = $this->department($actor);
        $targetDepartment = $this->department($recipient);
        if ($role === 'Team Leader' && $department === 'IT' && $target === 'Corporate Services') return true;
        if ($target === 'Team Leader') {
            if ($role === 'Operations Manager') return true;
            if ($collaborative && in_array($role, ['Team Leader','Chief Vet'])) return true;
            if ($role === 'Corporate Services' && ($collaborative || in_array($department, ['Internal Audit','Operations & Finance']))) return true;
        }
        if ($role === 'Corporate Services' && $department === 'Operations & Finance'
            && $targetDepartment === 'IT' && $target === 'Employee') return false;
        $sameBranch = count(array_intersect($this->branches($actor), $this->branches($recipient))) > 0;
        return match ($role) {
            'EVP' => in_array($target, ['Operations Manager','Chief Vet','Corporate Services','Team Leader']),
            'Corporate Services' => in_array($target, ['Team Leader','Employee']) && in_array($targetDepartment,
                $department === 'Operations & Finance' ? ['Operations & Finance','Accounting','Procurement','Internal Audit','IT'] : [$department]),
            'Chief Vet' => $sameBranch && in_array($target, ['Team Leader','Employee']) && in_array($targetDepartment, ['Veterinary','Vet Tech','Clinic Assistant']),
            'Operations Manager' => $sameBranch && in_array($target, ['Team Leader','Employee']),
            'Team Leader' => ($target === 'Team Leader' && ($department === 'IT' || $targetDepartment === 'IT' && $workCategory === 'reportorial'))
                || ($sameBranch && $target === 'Employee' && $department === $targetDepartment),
            default => false,
        };
    }

    public function utility(User $user): bool
    {
        return (bool) preg_match('/utility|housekeeping/i', $user->position?->name ?? '');
    }

    public function reviewer(User $actor, array $task, ?TaskModuleRecord $parent = null): ?User
    {
        if ($parent) return User::find($parent->assignee_id ?: $parent->creator_id);
        $people = User::with(['position','department','branch','branches'])->get()->filter(fn ($person) => $this->active($person) && $person->id !== $actor->id);
        if (str_starts_with($task['template'] ?? '', 'it-') || in_array($task['template'] ?? '', ['narrative-report','intern-weekly-report','daily-operations'])) {
            $leader = $people->first(fn ($person) => $this->role($person) === 'Team Leader' && $this->department($person) === $task['department']);
            if ($leader) return $leader;
        }
        $department = $this->department($actor);
        if ($this->role($actor) === 'Employee' && $this->utility($actor)) {
            return $people->first(fn ($person) => $this->role($person) === 'Team Leader'
                && $this->department($person) === $department && in_array($task['branch'], $this->branches($person)));
        }
        if ($this->role($actor) === 'Team Leader') {
            return $people->first(fn ($person) => $this->role($person) === 'Operations Manager' && $person->branch?->name === $task['branch']);
        }
        return $people->first(fn ($person) => $this->role($person) === 'EVP');
    }
}
