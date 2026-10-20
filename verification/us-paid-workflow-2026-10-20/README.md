# Hosted workflow dependency correction

The first main check after PR8 (`39369516308`, revision
`b15af771ae5126ff0bfc1dfd5c14d6496c583155`) passed its build. Its separate
production job stopped before HTTP checks with `ERR_MODULE_NOT_FOUND: fflate`.
The new CPI validator imports the workbook module, and fresh jobs do not share
the dependencies installed in the build job.

Both the production checker and the serialized collector now run
`npm ci --omit=dev` from the committed lockfile before their Node entrypoints.
The collector has the same import dependency, so the correction prevents the
same setup failure on its next normal daily execution. No scheduled run was
dispatched to test this change.

A clean Git archive with only production dependencies installed successfully
loads the information, monitor-contract, monitor-state and checkpoint modules.
`diagnosis.json` records the failure and this probe. Hosted acceptance requires
the PR build and merged-main production job to pass. That production check does
not establish scheduled monitoring evidence.

The released Worker, schedules, checkpoint, pending delivery event and source
alerts are unchanged. The successful both-domain release captures remain in
`verification/us-paid-2026-10-20/`; no reader re-release is required.
