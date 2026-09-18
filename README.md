# terraform-kics-test

This repository contains Terraform examples and an Azure DevOps pipeline for scanning the repository with [KICS](https://docs.kics.io/latest/). The pipeline is intentionally limited to security scanning. It does not run Terraform initialization, planning, validation, or deployment.

## Pipeline

The pipeline definition is [azure-pipelines.yml](azure-pipelines.yml). It is manually triggered (`trigger: none`, `pr: none`) and runs on the `ADO-Pool` agent pool.

The agent must have:

- Docker installed and available to the pipeline user
- Permission to pull the `checkmarx/kics:latest` image
- Azure CLI available if JSON upload is enabled

KICS scans the checked-out repository using the official Docker image. Findings do not block later pipeline steps because the scan uses `continueOnError: true`.

## Reports

Each scan requests JSON, HTML, and SARIF output:

| Format | Destination | Purpose |
| --- | --- | --- |
| SARIF | `CodeAnalysisLogs` build artifact | Consumed by the SARIF Azure DevOps viewer/security-results extension |
| HTML | `kics-html` build artifact | Downloadable human-readable report |
| JSON | `kics-json` build artifact | Machine-readable report for inspection or backup |
| JSON | Azure Blob Storage, optional | Central reporting and aggregation |

### Viewing SARIF findings

`PublishBuildArtifacts@1` stores the SARIF file, but it does not create a scan view by itself. To render the findings:

1. Install the [SARIF SAST Scans Tab extension](https://marketplace.visualstudio.com/items?itemName=sariftools.sarif-viewer-build-tab) in the Azure DevOps organization. An organization administrator may be required.
2. Run the pipeline again after the extension is installed. The artifact must be named `CodeAnalysisLogs`; this pipeline already uses that name.
3. Open the completed pipeline run and select the **Scans** tab on the build results page. Open **SARIF SAST Scans Tab** if that is the label shown by the installed extension.

The extension is separate from [GitHub Advanced Security for Azure DevOps](https://learn.microsoft.com/azure/devops/repos/security/github-advanced-security-code-scanning). Advanced Security does not automatically ingest arbitrary KICS SARIF files from a build artifact. Publishing the file alone only makes it downloadable until the SARIF viewer extension is installed.

### Management summary

After every scan, the pipeline generates `summary.json` with Azure DevOps metadata, KICS version, scan time and start/end times, files scanned and parsed, severity totals, total findings, and a `securityGate` outcome. The value is `FAILED` when Critical or High findings are reported and `PASSED` otherwise. Enforcement is currently disabled for testing, so findings do not fail the pipeline. The summary is intended for centralized management reporting; use the SARIF **Scans** tab or HTML report for finding-level investigation.

## Optional Blob Upload

The pipeline uploads the current summary on every run. Create the following pipeline variables or variable-group values. `AZURE_SERVICE_CONNECTION` must identify an Azure service connection, and the service connection identity must have **Storage Blob Data Contributor** on the storage account. Do not store access keys, connection strings, or SAS tokens in the pipeline:

```text
AZURE_SERVICE_CONNECTION=<Azure DevOps service connection name>
KICS_STORAGE_ACCOUNT=<storage account name>
KICS_STORAGE_CONTAINER=<blob container name>
```

The pipeline uses `AzureCLI@2` with `--auth-mode login` to authenticate to Blob Storage. It uploads the generated `summary.json`, not the full KICS findings report. JSON summaries are uploaded under:

```text
current/<sanitized pipeline name>/summary.json
```

The pipeline name is derived from `Build.DefinitionName`; spaces and unsafe characters are replaced with hyphens. The scan reports remain available in Azure DevOps artifacts and the SARIF scan view. Weekly consolidated files are intentionally not created by this pipeline.
