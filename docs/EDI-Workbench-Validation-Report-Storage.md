# EDI Workbench Validation Report Storage

The EDI Workbench creates temporary XLSX and JSON report artifacts in an existing private Azure Blob Storage container.

## Application configuration

- `EDI_VALIDATION_REPORT_CONTAINER`: Existing private container name. Defaults to `validation-reports`.
- `EDI_VALIDATION_REPORT_SAS_MINUTES`: Read-only SAS lifetime from 5 through 15 minutes. Defaults to 10.

The report flow uses the existing Blob Storage account-name, account-key, and endpoint settings consumed by `blobStorageService.js`. No additional storage-account setting is required.

## Azure configuration

- Disable anonymous blob access on the storage account and container.
- Configure a Blob Storage lifecycle policy that deletes objects in the report container after the approved temporary-report retention period.
- Keep secure transfer required and storage encryption enabled.

Artifacts use hashed tenant segments, generated run identifiers, and random UUIDs. Do not introduce member names, SSNs, source filenames, or other PHI/PII into blob paths or logs.
