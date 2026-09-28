# Pentaho Employee UAT Sync

These version-controlled Pentaho artifacts maintain the current-state Employee
mirror used by the application after a terminally successful Pentaho run:

- `sync_budaya.kjb`
- `data_karyawan_budaya.ktr`

The transformation reads the complete SI-SDM snapshot and synchronizes
`pentaho_stage.employee_mirror`. The mirror key is `nip`; it is not a
transfer/event table and has no transfer identifier.

## Kettle properties

Configure these values only in the Pentaho runtime (for example,
`kettle.properties` or equivalent server-managed configuration):

- `PENTAHO_STAGE_HOST`
- `PENTAHO_STAGE_DATABASE`
- `PENTAHO_STAGE_PORT`
- `PENTAHO_STAGE_USER`
- `PENTAHO_STAGE_PASSWORD`
- `PENTAHO_SDM_HOST`
- `PENTAHO_SDM_DATABASE`
- `PENTAHO_SDM_PORT`
- `PENTAHO_SDM_USER`
- `PENTAHO_SDM_PASSWORD`
- `PENTAHO_LOG_DIR`

Do not commit property values or print them in deployment evidence.

## Deployment

1. Copy this directory to the operator-approved fixed Pentaho deployment
   directory, keeping the KJB and KTR beside each other.
2. Configure the application-side `PENTAHO_SYNC_JOB_LOCATION` to that fixed
   KJB location. The browser must never supply or override it.
3. Keep the KJB child path relative:
   `${Internal.Entry.Current.Directory}/data_karyawan_budaya.ktr`.
4. Apply `sql/grant-employee-mirror.sql` with an operator-supplied
   `pentaho_role` psql variable after the staging table exists.
5. Load the KJB/KTR in Spoon and validate their connections using the runtime
   properties before UAT execution.

The KJB declares no database parameters and does not pass parameters to the
KTR. The application sends only the configured job location and unique
external job name to the Pentaho service; it sends no database settings,
credentials, source query, destination table, or Employee rows.

## Runtime rules

- Keep the internal Pentaho scheduler disabled. UAT execution is owned by the
  application; do not run the same KTR concurrently from Spoon, a scheduler,
  or another application.
- Keep `wait_until_finished=Y` so the KJB succeeds only after the KTR
  finishes.
- Use Basic or Error logging only. The artifacts contain no `WriteToLog`
  steps; logs are limited to engine errors and aggregate step counts. Never
  add Employee-row or field-value logging.
- The application may read the mirror only after terminal Pentaho success.
- A new mirror row receives all four lifecycle fields. A changed row preserves
  `created_at`/`created_by` and refreshes
  `updated_at`/`updated_by`; an unchanged row preserves all four; a source
  deletion removes the mirror row.
- Rotate any credential previously embedded in an earlier artifact before UAT
  sign-off.
