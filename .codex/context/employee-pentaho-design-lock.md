# Employee / User / Pentaho / Participation — DESIGN LOCK

Status:

```text
DESIGN LOCKED
NO FURTHER GRILLING
READY FOR NORMAL ENGINEERING
```

This document is authoritative project context for Employee master data, User/PIC/VIEWER accounts, Pentaho/SI-SDM employee synchronization, Unit mapping, PIC eligibility/lifecycle, participation snapshots/corrections, and the participation workbook.

Read this document before classifying this feature family as blocked or reopening business decisions.

## 1. Domain ownership

```text
Employee = seluruh data karyawan dari Pentaho
User = akun aplikasi
```

Locked:
- One Employee may have at most one User.
- Ordinary Employees do not automatically have application accounts.
- VIEWER remains supported for future use.
- Pentaho owns Employee/HR data only.
- Pentaho does not grant roles or create/activate application accounts.
- Admin is the only party that may create/link/assign User as PIC or VIEWER.
- Bootstrap/local Admin may exist without an Employee link.

### Identity

For now:

```text
Employee identity = NIP
```

NIP is unique for the current implementation. A future NOREG/person ID may replace it later. Missing that future identity is not a blocker now.

## 2. Three separate active/presence concepts

### Employment-active

Derived from HR values:

```text
KODE_STATPEG = "01"
AND STAT_KEPEG = "02"
```

Do not replace this with a generic Employee `isActive`.

### Source presence

Use:

```text
Employee.isPresentInSource
```

- true: exists in latest successful full Pentaho snapshot.
- false: absent from a complete validated successful full snapshot.

Do not overwrite latest known HR status codes just to represent source absence.

### Application account status

```text
User.isActive
```

This is independent from employment status and source presence.

## 3. PIC eligibility

PIC eligibility is derived, not stored as a separate boolean.

```text
JENJANG IN ("4", "5")
AND KODE_STATPEG = "01"
AND STAT_KEPEG = "02"
AND isPresentInSource = true
```

Centralize the rule conceptually:

```text
isEmploymentActive(employee)
isPicEligible(employee)
```

Enforce it for candidate search, assignment/reactivation, SSO, PIC authorization APIs, and synchronization reconciliation.

## 4. Employee Unit vs User Unit

```text
Employee.unitId
= actual work placement from Pentaho

User.unitId
= explicit application/PIC assignment scope
```

Pentaho may update Employee.unitId but must not automatically update User.unitId.

If a PIC Employee moves unit:

```text
Employee.unitId: old -> new
User.isActive: true -> false
User.unitId: keep previous explicit assignment until Admin reassigns
```

Admin must explicitly verify, reassign, and reactivate.

## 4A. Admin management UI ownership

The existing `ManagementUserView.tsx` and the new Employee/User management
page are two separate application concerns. Both Admin surfaces must coexist.

### Existing `ManagementUserView`

`ManagementUserView.tsx` remains the operational PIC management surface. Its
scope is the explicit application/PIC authorization assignment:

```text
User.unitId
```

Its conceptual operational flow remains:

```text
select unit type
→ select application unit
→ list operational PIC accounts by User.unitId
→ activate/deactivate eligible PIC account
→ demote/remove PIC assignment where supported
```

Locked requirements:

- Do not reinterpret `Employee.unitId` as this page's primary scope.
- Do not convert this page into the Employee HR/Pentaho management page.
- LOCAL debug/breakglass PIC accounts remain excluded from normal operational
  PIC listings.
- If applied behavior has drifted from this contract, Task 11 may make only a
  bounded compatibility correction. This is reconciliation, not a redesign of
  the old page.

### New Employee/User management surface

Task 11 introduces a separate Admin surface, for example:

```text
/admin/management/employees
```

This surface owns:

```text
Employee HR/Pentaho state
↔ User account
↔ role
↔ explicit application authorization scope
```

The UI must distinguish:

- Employee source presence;
- employment-active status;
- PIC eligibility;
- `Employee.unitId` as HR work placement;
- User linked/unlinked state;
- `User.isActive`;
- User role and auth provider;
- `User.unitId` as explicit application authorization assignment.

Changing `Employee.unitId` must not silently mutate `User.unitId`.

The new surface handles normal Employee-backed account administration,
including Employee ADMIN/PIC assignment, VIEWER support where applicable,
account linking/creation, explicit application scope assignment, and
activation/reactivation according to locked backend policy. LOCAL
debug/breakglass accounts remain separate from normal Employee management.

### Coexistence rule

```text
Old operational PIC management
→ User.unitId operational scope

New Employee/User management
→ Employee HR state + User linkage/role/authorization administration
```

Task 11 must not replace or repurpose the old operational page.

## 5. Pentaho synchronization

Use a FULL SNAPSHOT.

- A run is authoritative only after the entire batch validates successfully.
- Failed/partial batches must not mark Employees missing.
- Normal sync is reconcile/upsert, never wipe/delete-all.
- Historical Unit/Employee data must not be hard-deleted after use.
- Pentaho cannot mutate User role/account authorization fields.

Conceptual flow:

```text
receive full batch
→ validate whole batch
→ if failed: record failure, do not reconcile missing
→ if successful: atomically reconcile Employee + Unit mapping
→ mark source presence
→ apply mutation/account-deactivation rules
→ mark sync succeeded
```

### Missing Employee after successful full snapshot

```text
isPresentInSource = false
linked User.isActive = false
```

No hard delete. Preserve User role and historical records.

### Reappearing Employee

```text
isPresentInSource = true
Employee data updates
User remains inactive
```

Admin must explicitly reactivate/reassign the account.

### Unit mapping

Map external organization to Unit by stable code, not display name:

```text
sourceSystem + externalUnitCode -> Unit
```

Exact Pentaho source field names are deferred; the internal mapping seam is not deferred.

## 6. Headcount

Headcount includes direct Employees satisfying:

```text
isPresentInSource = true
AND KODE_STATPEG = "01"
AND STAT_KEPEG = "02"
AND Employee.unitId = target unit
```

JENJANG/PIC eligibility is not a headcount filter.

Kanwil does not roll up child Kancab Employees.

## 7. Participation snapshot

Unique key:

```text
unitId + categoryId + year + quarter/triwulan
```

Denominator is frozen on the FIRST SUCCESSFUL COMMIT/IMPORT.

```text
preview
→ informational estimate only

first successful commit
→ reread latest successful Employee full snapshot
→ calculate direct active headcount
→ atomically store frozen snapshot
```

Store at minimum:

```text
headcount / jumlahKaryawan
participantCount / jumlahPartisipasi
percentage
employeeSyncRunId
snapshotAt / headcountCapturedAt
frozen unit name
frozen parent unit name
```

Historical category label may also be frozen where useful.

After first commit, later Pentaho syncs must not recalculate the denominator.

### Percentage rules

```text
participantCount < 0
→ reject

participantCount > headcount
→ reject

headcount = 0 AND participantCount = 0
→ allowed
→ percentage = 0.00
→ warning
```

Store percentage with two decimal places.

## 8. Re-import / correction

Re-import for an existing period is a CORRECTION, not a new snapshot.

- Preserve original headcount.
- Preserve original employeeSyncRunId.
- Admin may change participantCount.
- Recalculate percentage using frozen denominator.
- Preview marks existing row as conflict/correction.
- Commit requires explicit overwrite confirmation.
- Correction requires reason.
- Audit old/new count, old/new percentage, actor, actor display snapshot/name, time, reason.

## 9. Workbook contract

Sheets:

```text
Summary / Ringkasan
Kanwil
Kancab
Divisi
Instructions/Reference / Petunjuk-Referensi
```

Columns:

```text
No
Kode Unit
Unit Kerja
Induk Unit Kerja
Jumlah Karyawan
Jumlah Partisipasi
Persentase
```

- Kode Unit is the identifier.
- Headcount is system-filled.
- Participant count is Admin input.
- Percentage is backend-calculated.
- Use filterable Excel tables.
- Historical exports use frozen names/hierarchy.

## 10. Auth behavior relevant to PIC

PIC SSO/access should verify current state rather than trust only sync side effects:

```text
User.isActive
Employee link
Employee.isPresentInSource
isPicEligible(Employee)
explicit User.unitId assignment/scope
```

Keep the locked local bootstrap Admin flow.

## 11. Initial reset

```text
INITIAL RESET
!=
NORMAL PENTAHO SYNC
```

Dummy cleanup is one-time setup/development reset only. Preserve bootstrap Admin. Never put delete-all logic in normal sync.

## 12. Explicitly deferred external Pentaho inputs

These are not blockers for internal schema/domain/snapshot work:

- exact field name for jenjang;
- eventual NOREG/person ID;
- exact organization source column names;
- endpoint URL;
- authentication method;
- push vs pull;
- transport mechanism.

Treat them as an external adapter contract.

Do not invent these details.

They become blockers only for the specific live-integration task that genuinely requires them.

## 13. Prohibited reinterpretations

```text
isPresentInSource != employment-active status
Employee.unitId != User.unitId PIC assignment
Pentaho placement != automatic application authorization
missing Employee != hard delete
reappearing Employee != automatic User reactivation
re-import != fresh denominator snapshot
zero headcount != automatic rejection
missing Pentaho endpoint/auth != blocker for Task 1 internal schema/domain work
```

If repository evidence shows a genuine contradiction, report the exact conflict instead of reopening the full design.
