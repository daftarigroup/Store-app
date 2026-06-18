/**
 * One-off script: regenerate already-uploaded issue/return slips so they include
 * the corrected PROJECT NAME and the new PLANNED DATE field.
 *
 * It rebuilds the PDF from each record's existing data and re-uploads it,
 * updating only the `issue_slip` / `return_slip` URL. No other record fields
 * (actual1, status, given_qty, dates) are touched.
 *
 * Usage:
 *   node_modules/.bin/tsx scripts/regenerateSlips.mts --dry   # report only, no writes
 *   node_modules/.bin/tsx scripts/regenerateSlips.mts         # regenerate + upload + update
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as React from 'react';
import { createElement } from 'react';
import { renderToBuffer } from '@react-pdf/renderer';

// IssuePdf.tsx uses JSX without importing React (relies on Vite's automatic
// runtime). tsx transpiles with the classic runtime, so expose React globally.
(globalThis as any).React = React;
import { createClient } from '@supabase/supabase-js';
import IssuePdf from '../src/components/element/IssuePdf.tsx';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry');

// ---- env ----
function loadEnv() {
    const raw = readFileSync(resolve(ROOT, '.env'), 'utf8');
    const env: Record<string, string> = {};
    for (const line of raw.split('\n')) {
        const m = line.match(/^([A-Z0-9_]+)=(.*?)\r?$/);
        if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
    return env;
}
const env = loadEnv();
const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_KEY = env.VITE_SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env');
    process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ---- logo (matches app: public/logo.png embedded as base64) ----
function loadLogo(): string {
    try {
        const buf = readFileSync(resolve(ROOT, 'public/logo.png'));
        return `data:image/png;base64,${buf.toString('base64')}`;
    } catch {
        return '';
    }
}
const logo = loadLogo();

// ---- helpers (mirror src/lib/utils.formatDate + IssueData date stamp) ----
const pad = (n: number) => String(n).padStart(2, '0');
function formatDate(value?: string): string {
    if (!value) return '';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
}
function generationStamp(): string {
    return new Date().toLocaleString('en-IN', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
    });
}

async function buildSlip(type: 'issue' | 'return', r: any): Promise<Buffer> {
    const issuedQty = Number(r.given_qty) > 0 ? Number(r.given_qty) : Number(r.quantity) || 0;
    const element = createElement(IssuePdf, {
        type,
        issueNumber: r.issue_no,
        date: generationStamp(),
        plannedDate: formatDate(r.planned1),
        constructorName: r.constructor_name || '',
        siteLocation: r.site_location || '',
        projectName: r.firm_name || '',
        remarks: r.issue_to || '',
        issuePersonName: r.issue_person_name || '',
        returnPersonName: r.return_person_name || '',
        damageRemark: r.damage_remark || '',
        rejectedDamageQty: r.rejected_damage_qty ? Number(r.rejected_damage_qty) : 0,
        products: [{
            productName: r.product_name,
            groupHead: r.group_head,
            quantity: issuedQty,
            uom: r.uom,
        }],
        logo,
    });
    return renderToBuffer(element as any);
}

async function uploadSlip(type: 'issue' | 'return', issueNo: string, buf: Buffer): Promise<string> {
    const fileName = `${issueNo}_${type}_${Date.now()}.pdf`;
    const filePath = `indent-pdfs/${fileName}`;
    const { error: uploadError } = await supabase.storage
        .from('indent_attachment')
        .upload(filePath, buf, { contentType: 'application/pdf' });
    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from('indent_attachment').getPublicUrl(filePath);
    return data.publicUrl;
}

async function main() {
    console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE (will upload + update)'}`);
    console.log(`Logo embedded: ${logo ? 'yes' : 'no'}`);

    const { data: records, error } = await supabase
        .from('issue')
        .select('*')
        .or('issue_slip.not.is.null,return_slip.not.is.null');
    if (error) throw error;

    const rows = (records || []).filter(r => r.issue_slip || r.return_slip);
    console.log(`Records with a slip: ${rows.length}`);

    let issueCount = 0, returnCount = 0, failed = 0;
    for (const r of rows) {
        try {
            const update: Record<string, string> = {};
            if (r.issue_slip) {
                const buf = await buildSlip('issue', r);
                update.issue_slip = DRY_RUN ? '(dry)' : await uploadSlip('issue', r.issue_no, buf);
                issueCount++;
            }
            if (r.return_slip) {
                const buf = await buildSlip('return', r);
                update.return_slip = DRY_RUN ? '(dry)' : await uploadSlip('return', r.issue_no, buf);
                returnCount++;
            }
            if (!DRY_RUN && Object.keys(update).length) {
                const { error: upErr } = await supabase.from('issue').update(update).eq('id', r.id);
                if (upErr) throw upErr;
            }
            console.log(`✓ ${r.issue_no} (id ${r.id}) — project="${r.firm_name || ''}" planned=${formatDate(r.planned1) || '-'}`);
        } catch (e) {
            failed++;
            console.error(`✗ ${r.issue_no} (id ${r.id}):`, (e as Error).message);
        }
    }

    console.log(`\nDone. issue slips: ${issueCount}, return slips: ${returnCount}, failed: ${failed}`);
    if (DRY_RUN) console.log('No data was written. Re-run without --dry to apply.');
}

main().catch(e => { console.error(e); process.exit(1); });
