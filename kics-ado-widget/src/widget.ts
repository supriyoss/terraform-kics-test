import * as SDK from "azure-devops-extension-sdk";

interface PipelineSummary {
    pipelineName?: string;
    repository?: string;
    buildId?: number;
    critical?: number;
    high?: number;
    medium?: number;
    low?: number;
    info?: number;
    securityGate?: string;
    buildUrl?: string;
}

interface WeeklySummary {
    weekEnding?: string;
    generatedAt?: string;

    pipelinesMonitored?: number;

    currentState?: {
        critical?: number;
        high?: number;
        medium?: number;
        low?: number;
        info?: number;
    };

    securityGates?: {
        passed?: number;
        failed?: number;
        passRate?: number;
    };

    pipelines?: PipelineSummary[];
}

function escapeHtml(value: unknown): string {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function render(settingsString?: string): void {

    const dashboard =
        document.getElementById("dashboard")!;

    const error =
        document.getElementById("error")!;

    if (!settingsString) {

        dashboard.classList.add("hidden");

        document.getElementById("lastUpdated")!.textContent =
            "No weekly KICS summary has been published yet.";

        return;
    }

    try {

        const data: WeeklySummary =
            JSON.parse(settingsString);

        document.getElementById("pipelines")!.textContent =
            String(data.pipelinesMonitored ?? 0);

        document.getElementById("failedGates")!.textContent =
            String(data.securityGates?.failed ?? 0);

        document.getElementById("critical")!.textContent =
            String(data.currentState?.critical ?? 0);

        document.getElementById("high")!.textContent =
            String(data.currentState?.high ?? 0);

        document.getElementById("lastUpdated")!.textContent =
            `Weekly snapshot: ${
                data.generatedAt ??
                data.weekEnding ??
                "Unknown"
            }`;

        const tbody =
            document.getElementById("pipelineRows")!;

        tbody.innerHTML = "";

        const pipelines =
            data.pipelines ?? [];

        pipelines.forEach((pipeline) => {

            const row =
                document.createElement("tr");

            const name =
                escapeHtml(pipeline.pipelineName);

            const pipelineCell =
                pipeline.buildUrl
                    ? `<a href="${escapeHtml(
                          pipeline.buildUrl
                      )}" target="_blank">${name}</a>`
                    : name;

            row.innerHTML = `
                <td>${pipelineCell}</td>
                <td>${pipeline.critical ?? 0}</td>
                <td>${pipeline.high ?? 0}</td>
                <td>${pipeline.medium ?? 0}</td>
                <td>${escapeHtml(
                    pipeline.securityGate
                )}</td>
            `;

            tbody.appendChild(row);
        });

        error.textContent = "";
        dashboard.classList.remove("hidden");

    }
    catch (err) {

        dashboard.classList.add("hidden");

        error.textContent =
            `Unable to parse KICS dashboard data: ${String(err)}`;
    }
}

SDK.init({
    loaded: false
});

SDK.ready().then(() => {

    SDK.register("KicsSecurityWidget", () => {

        return {

            load: (
                widgetSettings: any
            ) => {

                render(
                    widgetSettings?.settings
                );

                return {
                    state: 0
                };
            },

            reload: (
                widgetSettings: any
            ) => {

                render(
                    widgetSettings?.settings
                );

                return {
                    state: 0
                };
            }
        };

    });

    SDK.notifyLoadSucceeded();

});