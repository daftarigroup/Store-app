/**
 * Web Worker: Indent PDF generation
 *
 * @react-pdf/renderer is CPU-intensive but has no DOM dependency, so it runs
 * safely off the main thread. The main thread posts props; this worker returns
 * a Blob without ever blocking the UI.
 */
import { pdf } from '@react-pdf/renderer';
import { createElement } from 'react';
import IndentPdf from '@/components/element/IndentPdf';
import type { IndentPdfProps } from '@/components/element/IndentPdf';

self.onmessage = async (e: MessageEvent<IndentPdfProps>) => {
    try {
        const blob = await pdf(createElement(IndentPdf, e.data) as any).toBlob();
        self.postMessage({ ok: true, blob });
    } catch (err: any) {
        self.postMessage({ ok: false, error: err?.message ?? 'PDF generation failed' });
    }
};
