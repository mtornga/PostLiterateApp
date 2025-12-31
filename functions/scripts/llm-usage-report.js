#!/usr/bin/env node
'use strict';

const { Logging } = require('@google-cloud/logging');

function parseArgs(argv) {
    const options = {
        days: 7,
        projectId: undefined,
        json: false,
    };

    for (const arg of argv) {
        if (arg === '--json') {
            options.json = true;
            continue;
        }
        if (arg.startsWith('--days=')) {
            const value = Number.parseInt(arg.split('=')[1], 10);
            if (Number.isFinite(value) && value > 0) {
                options.days = Math.min(value, 365);
            }
            continue;
        }
        if (arg.startsWith('--project=')) {
            options.projectId = arg.split('=')[1];
        }
    }

    return options;
}

function formatDate(date) {
    return date.toISOString().slice(0, 10);
}

function median(values) {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 1) return sorted[mid];
    return (sorted[mid - 1] + sorted[mid]) / 2;
}

function getPayload(entry) {
    return entry?.data || entry?.metadata?.jsonPayload || {};
}

async function fetchEntries(logging, filter) {
    const [entries] = await logging.getEntries({
        filter,
        orderBy: 'timestamp asc',
        autoPaginate: true,
    });
    return entries;
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    const logging = new Logging(options.projectId ? { projectId: options.projectId } : undefined);

    const end = new Date();
    const start = new Date(end.getTime() - options.days * 24 * 60 * 60 * 1000);
    const startIso = start.toISOString();
    const endIso = end.toISOString();

    const serviceFilter = '(resource.labels.service_name="explain" OR resource.labels.service_name="explainPipeline")';

    const modelFilter = [
        `timestamp>="${startIso}"`,
        `timestamp<="${endIso}"`,
        'jsonPayload.event="llm_model_selected"',
        serviceFilter,
    ].join(' AND ');

    const latencyFilter = [
        `timestamp>="${startIso}"`,
        `timestamp<="${endIso}"`,
        'jsonPayload.message="[TIMING] Gemini API"',
        serviceFilter,
    ].join(' AND ');

    const [modelEntries, latencyEntries] = await Promise.all([
        fetchEntries(logging, modelFilter),
        fetchEntries(logging, latencyFilter),
    ]);

    const usageByModel = new Map();
    const usageByVariant = new Map();
    const usageByPipeline = new Map();
    for (const entry of modelEntries) {
        const payload = getPayload(entry);
        const model = payload.model || 'unknown';
        const variant = payload.variant || 'unknown';
        const pipeline = payload.pipeline || 'unknown';

        usageByModel.set(model, (usageByModel.get(model) || 0) + 1);
        usageByVariant.set(`${model} (${variant})`, (usageByVariant.get(`${model} (${variant})`) || 0) + 1);
        usageByPipeline.set(`${model} | ${pipeline}`, (usageByPipeline.get(`${model} | ${pipeline}`) || 0) + 1);
    }

    const latencyByModel = new Map();
    const latencyByPipeline = new Map();
    for (const entry of latencyEntries) {
        const payload = getPayload(entry);
        const model = payload.model || 'unknown';
        const pipeline = payload.pipeline || 'unknown';
        const duration = Number(payload.durationMs);
        if (!Number.isFinite(duration)) continue;

        if (!latencyByModel.has(model)) latencyByModel.set(model, []);
        latencyByModel.get(model).push(duration);

        const pipelineKey = `${model} | ${pipeline}`;
        if (!latencyByPipeline.has(pipelineKey)) latencyByPipeline.set(pipelineKey, []);
        latencyByPipeline.get(pipelineKey).push(duration);
    }

    const output = {
        range: { start: startIso, end: endIso },
        days: options.days,
        usageByModel: Object.fromEntries(usageByModel),
        usageByVariant: Object.fromEntries(usageByVariant),
        usageByPipeline: Object.fromEntries(usageByPipeline),
        latencyMs: {
            byModel: Object.fromEntries(
                [...latencyByModel.entries()].map(([model, values]) => [
                    model,
                    { count: values.length, medianMs: median(values) },
                ])
            ),
            byPipeline: Object.fromEntries(
                [...latencyByPipeline.entries()].map(([key, values]) => [
                    key,
                    { count: values.length, medianMs: median(values) },
                ])
            ),
        },
    };

    if (options.json) {
        console.log(JSON.stringify(output, null, 2));
        return;
    }

    console.log(`LLM usage report (${formatDate(start)} → ${formatDate(end)})`);
    console.log('');

    console.log('Usage by model');
    console.table(output.usageByModel);

    console.log('Usage by model + variant');
    console.table(output.usageByVariant);

    console.log('Usage by model + pipeline');
    console.table(output.usageByPipeline);

    console.log('Median latency by model (ms)');
    console.table(output.latencyMs.byModel);

    console.log('Median latency by model + pipeline (ms)');
    console.table(output.latencyMs.byPipeline);
}

main().catch((error) => {
    console.error('Failed to generate report:', error?.message || error);
    process.exitCode = 1;
});
