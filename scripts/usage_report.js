const { execSync } = require('child_process');

/**
 * READ FOR ME - RECENT ACTIVITY REPORT
 * Estimates usage and costs based on the latest 1000 lines of function logs.
 */

const OCR_COST_PER_REQ = 0.0015;
const GEMINI_INPUT_COST_1M_CHARS = 0.025;
const GEMINI_OUTPUT_COST_1M_CHARS = 0.10;

function getStats() {
    console.log('Fetching recent activity logs from Firebase...');

    try {
        // Fetch the maximum recommended lines for CLI performance (1000)
        const output = execSync('npx firebase functions:log -n 1000', { encoding: 'utf8' });
        const lines = output.split('\n').filter(l => l.trim());

        const stats = {
            total: { ocr: 0, explain: 0, cost: 0 },
            last30d: { ocr: 0, explain: 0, cost: 0 },
            last3d: { ocr: 0, explain: 0, cost: 0 }
        };

        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

        lines.forEach(line => {
            let timestamp = now;
            const dateMatch = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/);
            if (dateMatch) {
                timestamp = new Date(dateMatch[1] + 'Z');
            }

            const isWithin30d = timestamp >= thirtyDaysAgo;
            const isWithin3d = timestamp >= threeDaysAgo;

            let cost = 0;
            let type = null;

            const lowerLine = line.toLowerCase();
            const hasOcrKey = lowerLine.includes('ocr:');
            const hasExplainKey = lowerLine.includes('explain:');
            const hasOcrMarker = line.includes('OCR Completed Successfully') || line.includes('Text Detected:');
            const hasExplainMarker = line.includes('Explain Completed Successfully') || line.includes('Explanation generated successfully');
            const hasGeminiKey = line.includes('Calling Gemini API');

            if (hasOcrKey && hasOcrMarker) {
                type = 'ocr';
                cost = OCR_COST_PER_REQ;
            }
            else if (hasExplainKey && hasExplainMarker) {
                type = 'explain';
                cost = 0.0005;
                if (line.includes("{")) {
                    try {
                        const data = JSON.parse(line.substring(line.indexOf("{")));
                        if (data.explanationLength) cost = (data.explanationLength / 1000000) * GEMINI_OUTPUT_COST_1M_CHARS;
                    } catch (e) { }
                }
            }
            else if (hasGeminiKey) {
                if (line.includes("{")) {
                    try {
                        const data = JSON.parse(line.substring(line.indexOf("{")));
                        if (data.textLength) cost = (data.textLength / 1000000) * GEMINI_INPUT_COST_1M_CHARS;
                    } catch (e) { }
                } else {
                    cost = 0.0001;
                }
            }

            if (type === 'ocr') {
                stats.total.ocr++;
                if (isWithin30d) stats.last30d.ocr++;
                if (isWithin3d) stats.last3d.ocr++;
            } else if (type === 'explain') {
                stats.total.explain++;
                if (isWithin30d) stats.last30d.explain++;
                if (isWithin3d) stats.last3d.explain++;
            }

            stats.total.cost += cost;
            if (isWithin30d) stats.last30d.cost += cost;
            if (isWithin3d) stats.last3d.cost += cost;
        });

        if (stats.total.ocr === 0 && stats.total.explain === 0) {
            console.log('\n⚠️  No usage detected in the recent log buffer.');
            console.log('Search Tip: If you just deployed, the log buffer might be freshly cleared.');
        } else {
            printReport(stats, lines.length);
        }
    } catch (err) {
        console.error('\n❌ Error running firebase CLI:', err.message);
    }
}

function printReport(stats, lineCount) {
    console.log('\n================================================');
    console.log('   READ FOR ME - RECENT ACTIVITY REPORT');
    console.log(`   (Analyzed ${lineCount} log lines)`);
    console.log('================================================\n');

    const formatRow = (label, data) => {
        return `${label.padEnd(15)} | OCR: ${data.ocr.toString().padEnd(5)} | Explain: ${data.explain.toString().padEnd(5)} | Est. Cost: $${data.cost.toFixed(4)}`;
    };

    console.log(formatRow('RECENT TOTAL', stats.total));
    console.log(formatRow('LAST 30 DAYS', stats.last30d));
    console.log(formatRow('LAST 3 DAYS', stats.last3d));

    console.log('\nNote: Actual Gemini 2.0 Flash Exp calls are currently free.');
    console.log('================================================\n');
}

getStats();
