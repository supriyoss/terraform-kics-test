import * as SDK from "azure-devops-extension-sdk";

interface PipelineSummary {
    pipelineName?: string;
    repository?: string;
    buildId?: number | string;
    buildNumber?: string;
    branch?: string;
    scanTime?: string;
    kicsVersion?: string;
    critical?: number;
    high?: number;
    medium?: number;
    low?: number;
    info?: number;
    totalFindings?: number;
    securityGate?: string;
    buildUrl?: string;
}

interface WeeklySummary {
    weekEnding?: string;
    generatedAt?: string;
    reportingPeriod?: string;
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

function toNumber(value: number | undefined): number {
    return Number.isFinite(value) ? Number(value) : 0;
}

function formatDate(value?: string): string {
    if (!value) {
        return "Unknown";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function riskScore(pipeline: PipelineSummary): number {
    return (
        toNumber(pipeline.critical) * 100000 +
        toNumber(pipeline.high) * 1000 +
        toNumber(pipeline.medium) * 10 +
        toNumber(pipeline.low)
    );
}

function setText(id: string, value: unknown): void {
    const el = document.getElementById(id);
    if (el) {
        el.textContent = String(value ?? "");
    }
}

function renderSeverityBars(data: WeeklySummary): void {
    const values = [
        { key: "critical", value: toNumber(data.currentState?.critical) },
        { key: "high", value: toNumber(data.currentState?.high) },
        { key: "medium", value: toNumber(data.currentState?.medium) },
        { key: "low", value: toNumber(data.currentState?.low) },
        { key: "info", value: toNumber(data.currentState?.info) }
    ];

    const max = Math.max(...values.map(item => item.value), 1);

    values.forEach(item => {
        setText(`severity-${item.key}-value`, item.value);

        const bar = document.getElementById(`severity-${item.key}-bar`);
        if (bar) {
            const width = item.value === 0 ? 0 : Math.max((item.value / max) * 100, 3);
            bar.style.width = `${width}%`;
        }
    });
}

function renderAttentionRequired(pipelines: PipelineSummary[]): void {
    const container = document.getElementById("attentionList");
    const section = document.getElementById("attentionSection");

    if (!container || !section) {
        return;
    }

    const attention = pipelines
        .filter(pipeline =>
            String(pipeline.securityGate ?? "").toUpperCase() === "FAILED" ||
            toNumber(pipeline.critical) > 0 ||
            toNumber(pipeline.high) > 0
        )
        .sort((a, b) => riskScore(b) - riskScore(a))
        .slice(0, 5);

    container.innerHTML = "";

    if (attention.length === 0) {
        container.innerHTML = `
            <div class="healthy-state">
                No pipelines currently require attention.
            </div>
        `;
        return;
    }

    attention.forEach(pipeline => {
        const item = document.createElement("div");
        item.className = "attention-item";

        const name = escapeHtml(pipeline.pipelineName ?? pipeline.repository ?? "Unknown pipeline");

        const nameHtml = pipeline.buildUrl
            ? `<a href="${escapeHtml(pipeline.buildUrl)}" target="_blank" rel="noopener noreferrer">${name}</a>`
            : name;

        item.innerHTML = `
            <div class="attention-main">
                <div class="attention-name">${nameHtml}</div>
                <div class="attention-meta">
                    Critical ${toNumber(pipeline.critical)}
                    <span>•</span>
                    High ${toNumber(pipeline.high)}
                    <span>•</span>
                    Total ${toNumber(pipeline.totalFindings)}
                </div>
            </div>
            <div class="gate-badge gate-failed">FAILED</div>
        `;

        container.appendChild(item);
    });
}

function renderPipelineTable(pipelines: PipelineSummary[]): void {
    const tbody = document.getElementById("pipelineRows");

    if (!tbody) {
        return;
    }

    tbody.innerHTML = "";

    const sorted = [...pipelines]
        .sort((a, b) => {
            const gateA = String(a.securityGate ?? "").toUpperCase() === "FAILED" ? 1 : 0;
            const gateB = String(b.securityGate ?? "").toUpperCase() === "FAILED" ? 1 : 0;

            if (gateA !== gateB) {
                return gateB - gateA;
            }

            return riskScore(b) - riskScore(a);
        });

    sorted.forEach(pipeline => {
        const row = document.createElement("tr");

        const name = escapeHtml(pipeline.pipelineName ?? pipeline.repository ?? "Unknown");
        const pipelineCell = pipeline.buildUrl
            ? `<a class="pipeline-link" href="${escapeHtml(pipeline.buildUrl)}" target="_blank" rel="noopener noreferrer">${name}</a>`
            : name;

        const gate = String(pipeline.securityGate ?? "UNKNOWN").toUpperCase();
        const gateClass = gate === "PASSED" ? "gate-passed" : gate === "FAILED" ? "gate-failed" : "gate-unknown";

        row.innerHTML = `
            <td>
                <div class="pipeline-name">${pipelineCell}</div>
                <div class="pipeline-sub">${escapeHtml(pipeline.repository ?? "")}</div>
            </td>
            <td class="num">${toNumber(pipeline.critical)}</td>
            <td class="num">${toNumber(pipeline.high)}</td>
            <td class="num">${toNumber(pipeline.medium)}</td>
            <td class="num">${toNumber(pipeline.totalFindings)}</td>
            <td><span class="gate-badge ${gateClass}">${escapeHtml(gate)}</span></td>
        `;

        tbody.appendChild(row);
    });

    setText("pipelineCountLabel", `${sorted.length} pipeline${sorted.length === 1 ? "" : "s"}`);
}

function render(settingsString?: string): void {
    const dashboard = document.getElementById("dashboard");
    const emptyState = document.getElementById("emptyState");
    const error = document.getElementById("error");

    if (!dashboard || !emptyState || !error) {
        return;
    }

    if (!settingsString) {
        dashboard.classList.add("hidden");
        error.classList.add("hidden");
        emptyState.classList.remove("hidden");
        return;
    }

    try {
        const data: WeeklySummary = JSON.parse(settingsString);
        const pipelines = Array.isArray(data.pipelines) ? data.pipelines : [];

        setText("pipelines", data.pipelinesMonitored ?? pipelines.length);
        setText("failedGates", data.securityGates?.failed ?? 0);
        setText("critical", data.currentState?.critical ?? 0);
        setText("high", data.currentState?.high ?? 0);

        const passRate = toNumber(data.securityGates?.passRate);
        setText("passRate", `${passRate.toFixed(passRate % 1 === 0 ? 0 : 1)}%`);

        setText("weekEnding", data.weekEnding ?? "Unknown");
        setText("lastUpdated", formatDate(data.generatedAt ?? data.weekEnding));

        renderSeverityBars(data);
        renderAttentionRequired(pipelines);
        renderPipelineTable(pipelines);

        emptyState.classList.add("hidden");
        error.classList.add("hidden");
        dashboard.classList.remove("hidden");
    }
    catch (err) {
        dashboard.classList.add("hidden");
        emptyState.classList.add("hidden");
        error.classList.remove("hidden");

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
            load: (widgetSettings: any) => {
                console.log("KICS widget settings:", widgetSettings);
                console.log("KICS custom settings data:", widgetSettings?.customSettings?.data);

                render(widgetSettings?.customSettings?.data);

                return {
                    state: 0
                };
            },

            reload: (widgetSettings: any) => {
                console.log("KICS widget reload:", widgetSettings);

                render(widgetSettings?.customSettings?.data);

                return {
                    state: 0
                };
            }
        };
    });

    SDK.notifyLoadSucceeded();
});
