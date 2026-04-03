import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
    if (!date) return '-';
    const dObj = typeof date === 'string' ? parseCustomDate(date) : date;
    if (!dObj || isNaN(dObj.getTime())) return typeof date === 'string' ? date : '-';
    
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(dObj.getDate())}-${pad(dObj.getMonth() + 1)}-${dObj.getFullYear()}`;
}

export function formatDateTime(date: Date | string): string {
    if (!date) return '-';
    const dObj = typeof date === 'string' ? parseCustomDate(date) : date;
    if (!dObj || isNaN(dObj.getTime())) return typeof date === 'string' ? date : '-';
    
    const pad = (n: number) => n.toString().padStart(2, '0');
    const day = pad(dObj.getDate());
    const month = pad(dObj.getMonth() + 1);
    const year = dObj.getFullYear();
    const hours = dObj.getHours();
    const minutes = pad(dObj.getMinutes());
    const seconds = pad(dObj.getSeconds());
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hour12 = pad(hours % 12 || 12);

    return `${day}-${month}-${year} ${hour12}:${minutes}:${seconds} ${ampm}`;
}

export function formatTimestamp(date: Date | string): string {
    return formatDateTime(date);
}

/**
 * Robustly parse dates from Supabase, handling both ISO and DD/MM/YY formats
 */
export function parseCustomDate(dateStr: any): Date {
    if (!dateStr) return new Date(NaN);
    if (dateStr instanceof Date) return isNaN(dateStr.getTime()) ? new Date(NaN) : dateStr;

    if (typeof dateStr === 'string') {
        const cleanStr = dateStr.trim();
        
        // 1. Handle ISO-like timestamps from DB (e.g. "2024-03-31 10:00:00")
        // If it has hyphens and colons but no timezone indicator (Z or +/-), assume UTC
        if (cleanStr.includes('-') && cleanStr.includes(':')) {
            if (!cleanStr.match(/([+-]\d{2,4}|[A-Z]{1,4}|Z)$/)) {
                // Ensure there's a 'T' between date and time for standard ISO parsing
                const isoFormatted = cleanStr.includes(' ') ? cleanStr.replace(' ', 'T') : cleanStr;
                const withZ = isoFormatted + 'Z';
                const d = new Date(withZ);
                if (!isNaN(d.getTime())) return d;
            }
        }

        // 2. Try standard parsing (handles "2024-03-31T10:00:00Z" etc.)
        const standardDate = new Date(cleanStr);
        if (!isNaN(standardDate.getTime())) return standardDate;

        // 3. Handle custom DD/MM/YY formats
        const match = cleanStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
        if (match) {
            const day = parseInt(match[1], 10);
            const month = parseInt(match[2], 10) - 1;
            let year = parseInt(match[3], 10);
            if (year < 100) year += 2000;

            const hours = match[4] ? parseInt(match[4], 10) : 0;
            const minutes = match[5] ? parseInt(match[5], 10) : 0;
            const seconds = match[6] ? parseInt(match[6], 10) : 0;

            // Note: This constructor uses LOCAL time
            const localD = new Date(year, month, day, hours, minutes, seconds);
            if (!isNaN(localD.getTime())) return localD;
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
