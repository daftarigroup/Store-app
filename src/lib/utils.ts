import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function formatDate(date: Date): string {
    if (!date || isNaN(date.getTime())) return '-';
    const d = date.getDate().toString().padStart(2, '0');
    const m = (date.getMonth() + 1).toString().padStart(2, '0'); // months are 0-based
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
}

export function formatDateTime(date: Date): string {
    if (!date || isNaN(date.getTime())) return '-';
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date
        .getFullYear()
        .toString()
        .slice(-2)} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
            date.getSeconds()
        )}`;
}

/**
 * Robustly parse dates from Supabase, handling both ISO and DD/MM/YY formats
 */
export function parseCustomDate(dateStr: any): Date {
    if (!dateStr) return new Date(NaN); // Consistent invalid date
    if (dateStr instanceof Date) return isNaN(dateStr.getTime()) ? new Date(NaN) : dateStr;

    // Try standard parsing first (handles ISO strings)
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d;

    // Handle DD/MM/YY HH:mm:ss or DD/MM/YYYY
    if (typeof dateStr === 'string') {
        const cleanStr = dateStr.trim();
        // Regex for DD/MM/YY or DD/MM/YYYY with optional time
        const match = cleanStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);

        if (match) {
            const day = parseInt(match[1], 10);
            const month = parseInt(match[2], 10) - 1; // 0-based
            let year = parseInt(match[3], 10);

            if (year < 100) year += 2000; // Assume 20xx for 2-digit years

            const hours = match[4] ? parseInt(match[4], 10) : 0;
            const minutes = match[5] ? parseInt(match[5], 10) : 0;
            const seconds = match[6] ? parseInt(match[6], 10) : 0;

            const newD = new Date(year, month, day, hours, minutes, seconds);
            if (!isNaN(newD.getTime())) return newD;
        }
    }

    return new Date(NaN);
}

export function calculateTotal(
    rate: number,
    gstPercent: number,
    discountPercent: number,
    quantity: number
): number {
    const baseAmount = rate * quantity;
    const discountedAmount = baseAmount - (baseAmount * discountPercent) / 100;
    const totalWithGst = discountedAmount + (discountedAmount * gstPercent) / 100;
    return parseFloat(totalWithGst.toFixed(2)); // Rounded to 2 decimal places
}

export function calculateSubtotal(
    items: {
        rate: number;
        quantity: number;
        discountPercent: number;
    }[]
): number {
    const total = items.reduce((sum, item) => {
        const base = item.rate * item.quantity;
        const discounted = base - (base * item.discountPercent) / 100;
        return sum + discounted;
    }, 0);

    return parseFloat(total.toFixed(2));
}

export function calculateTotalGst(
    items: {
        rate: number;
        quantity: number;
        discountPercent: number;
        gstPercent: number;
    }[]
): number {
    const totalGst = items.reduce((sum, item) => {
        const base = item.rate * item.quantity;
        const discounted = base - (base * item.discountPercent) / 100;
        const gstAmount = (discounted * item.gstPercent) / 100;
        return sum + gstAmount;
    }, 0);

    return parseFloat(totalGst.toFixed(2));
}

export function calculateGrandTotal(
    items: {
        rate: number;
        quantity: number;
        discountPercent: number;
        gstPercent: number;
    }[]
): number {
    const subtotal = calculateSubtotal(items);
    const gst = calculateTotalGst(items);
    return parseFloat((subtotal + gst).toFixed(2));
}


export function formatNumber(num: number) {
    if (num >= 1_000_000_000) {
        return (num / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
    }
    if (num >= 1_000_000) {
        return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    if (num >= 1_000) {
        return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
    }
    return num.toString();
}
