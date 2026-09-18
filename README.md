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

Install and configure the [SARIF Azure DevOps extension](https://github.com/Microsoft/sarif-azuredevops-extension) if SARIF findings should be rendered in the pipeline’s scan-results experience. Publishing the file alone does not parse or display the findings.

## Optional Blob Upload

Blob upload is disabled by default so the pipeline can run without a storage account. To enable it, set `KICS_UPLOAD_JSON` to `true` and provide these pipeline variables or variable-group values:

```text
KICS_UPLOAD_JSON=true
AZURE_SERVICE_CONNECTION=<Azure DevOps service connection name>
KICS_STORAGE_ACCOUNT=<storage account name>
KICS_STORAGE_CONTAINER=<blob container name>
```

The service connection identity needs the **Storage Blob Data Contributor** role on the target storage account or container. JSON reports are uploaded under:

```text
kics/<pipeline name>/<build number>/results.json
```

When upload is disabled, the JSON report remains available in the `kics-json` build artifact and the pipeline records a successful test-mode skip.
