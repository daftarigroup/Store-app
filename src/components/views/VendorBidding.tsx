import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchQuotationByToken, updateVendorRate } from '@/services/quotationService';
import { fetchMasterRecords } from '@/services/masterService';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Building2, Package, FileText, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Pill } from '@/components/ui/pill';

export default function VendorBidding() {
    const { token } = useParams<{ token: string }>();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [quotation, setQuotation] = useState<any[]>([]);
    const [masterVendor, setMasterVendor] = useState<any>(null);
    const [masterFirm, setMasterFirm] = useState<any>(null);
    const [rates, setRates] = useState<{ [key: string]: string }>({});
    const [submitted, setSubmitted] = useState(false);
    const [alreadySubmitted, setAlreadySubmitted] = useState(false);

    useEffect(() => {
        const loadQuotation = async () => {
            if (!token) return;
            try {
                const data = await fetchQuotationByToken(token);
                if (data && data.length > 0) {
                    setQuotation(data);
                    
                    // Fetch details from Master
                    const vendorName = data[0].supplierName;
                    const firmName = data[0].firm;
                    try {
                        const masterRecords = await fetchMasterRecords();
                        
                        // Look up Vendor
                        const vendorDetails = masterRecords.find(r => r.vendor_name === vendorName);
                        if (vendorDetails) setMasterVendor(vendorDetails);

                        // Look up Firm/Project - prioritize record with actual address data
                        const firmDetails = masterRecords.find(r => 
                            r.firm_name === firmName && (r.billing_address || r.destination_address)
                        ) || masterRecords.find(r => r.firm_name === firmName);
                        
                        if (firmDetails) {
                            setMasterFirm(firmDetails);
                        }

                    } catch (err) {
                        console.error('Error fetching master details:', err);
                    }

                    // Check if already submitted
                    const hasResponded = data.some((item: any) => 
                        item.responded_at !== null && item.responded_at !== undefined && item.responded_at !== ''
                    );
                    
                    if (hasResponded) {
                        setAlreadySubmitted(true);
                        setLoading(false);
                        return;
                    }

                    // Initialize rates with existing values if any
                    const initialRates: { [key: string]: string } = {};
                    data.forEach((item: any) => {
                        initialRates[item.indentNo] = item.vendor_rate ? String(item.vendor_rate) : '';
                    });
                    setRates(initialRates);
                }
            } catch (error) {
                console.error('Error loading quotation:', error);
                toast.error('Failed to load quotation details.');
            } finally {
                setLoading(false);
            }
        };

        loadQuotation();
    }, [token]);

    const handleRateChange = (indentNo: string, value: string) => {
        setRates(prev => ({ ...prev, [indentNo]: value }));
    };

    const handleSubmit = async () => {
        if (!token) return;
        
        // Validate all rates are entered
        const missingRates = quotation.some(item => !rates[item.indentNo]);
        if (missingRates) {
            toast.error('Please enter rates for all items.');
            return;
        }

        setSubmitting(true);
        try {
            for (const item of quotation) {
                const success = await updateVendorRate(token, item.indentNo, parseFloat(rates[item.indentNo]));
                if (!success) throw new Error(`Failed to update item ${item.indentNo}`);
            }
            toast.success('Rates submitted successfully!');
            setSubmitted(true);
        } catch (error) {
            console.error('Error submitting rates:', error);
            toast.error('Failed to submit rates. Please check if the link is still valid.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="text-center space-y-4">
                    <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mx-auto" />
                    <p className="text-slate-600 font-medium">Loading quotation details...</p>
                </div>
            </div>
        );
    }

    if (!quotation.length) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
                <Card className="max-w-md w-full border-red-100 shadow-xl">
                    <CardContent className="pt-10 pb-10 text-center space-y-4">
                        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto">
                            <AlertCircle className="w-8 h-8" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900">Invalid Link</h2>
                        <p className="text-slate-600">This quotation link is invalid or has expired. Please contact the administrator.</p>
                        <Button variant="outline" onClick={() => window.close()} className="mt-4">Close Tab</Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (submitted || alreadySubmitted) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
                <Card className="max-w-md w-full border-emerald-100 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
                    <div className="h-2 bg-emerald-500 w-full" />
                    <CardContent className="pt-12 pb-12 text-center space-y-6">
                        <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                            <CheckCircle2 className="w-10 h-10" />
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
                                {alreadySubmitted ? 'Already Submitted' : 'Thank You!'}
                            </h2>
                            <p className="text-lg text-slate-600">
                                {alreadySubmitted 
                                    ? 'A response for this quotation has already been recorded in our system.' 
                                    : 'Your quotation rates have been successfully recorded in our system.'}
                            </p>
                        </div>
                        <p className="text-sm text-slate-400 italic">You may now close this window.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const firstItem = quotation[0];

    return (
        <div className="min-h-screen bg-slate-50 py-10 px-4">
            <div className="max-w-5xl mx-auto space-y-6">
                {/* Dashboard-style Header */}
                <div className="space-y-4 p-8 bg-white shadow-md rounded-sm border-t-4 border-indigo-600">
                    <div className="flex items-center justify-center gap-6 bg-indigo-50/50 p-6 rounded-lg">
                        <img src="/logo.png" alt="Company Logo" className="w-24 h-24 object-contain" />
                        <div className="text-center md:text-left">
                            <h1 className="text-3xl font-bold text-slate-900">POOJA CONSTRUCTIONS</h1>
                            <div>
                                <p className="text-sm text-slate-600 max-w-md">104, 1ST FLOOR, BEHIND DAFTARI ARCADE, DHUNIWALE CHOWK, DAFTARI BUILDING, NAGPUR ROAD, WARDHA</p>
                                <p className="text-sm text-slate-600">Phone No: +8698859888</p>
                            </div>
                        </div>
                    </div>
                    
                    <hr className="border-slate-100" />
                    <div className="text-center space-y-1">
                        <h2 className="font-bold text-xl text-slate-800 uppercase tracking-wide">Quotation Bidding Portal</h2>
                        <div className="flex justify-center gap-4 text-sm text-slate-500">
                            <span>Quotation No: <span className="font-bold text-indigo-600">{firstItem.quatationNo}</span></span>
                            <span>|</span>
                            <span>Date: <span className="font-bold">{new Date(firstItem.timestamp).toLocaleDateString()}</span></span>
                        </div>
                    </div>
                    <hr className="border-slate-100" />

                    {/* Address Cards Grid */}
                    <div className="grid md:grid-cols-3 gap-4 py-2">
                        <Card className="shadow-sm border-slate-200 rounded-sm">
                            <CardHeader className="bg-slate-50 px-5 py-2 border-b border-slate-100">
                                <CardTitle className="text-sm font-bold text-center text-slate-700">Vendor Identification</CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 text-[11px] space-y-2">
                                <div className="space-y-0.5">
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Official Name</p>
                                    <p className="font-extrabold text-sm text-indigo-700 uppercase leading-tight">
                                        {masterVendor?.vendor_name || firstItem.supplierName}
                                    </p>
                                    <Pill variant="primary" className="mt-1 h-4 text-[9px] bg-indigo-100 text-indigo-700 border-none">Verified Vendor</Pill>
                                </div>
                                {masterVendor ? (
                                    <div className="space-y-1 pt-1 border-t border-slate-100">
                                        <p className="text-slate-600 leading-tight font-medium">{masterVendor.vendor_address}</p>
                                        <p className="font-bold text-slate-700">GSTIN: {masterVendor.vendor_gstin}</p>
                                        <div className="text-slate-500 pt-1">
                                            <p>Email: {masterVendor.vendor_email || 'N/A'}</p>
                                            <p>Phone: {masterVendor.phone || 'N/A'}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-slate-400 italic pt-1 border-t border-slate-100">Searching master record...</p>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="shadow-sm border-slate-200 rounded-sm">
                            <CardHeader className="bg-slate-50 px-5 py-2 border-b border-slate-100">
                                <CardTitle className="text-sm font-bold text-center text-slate-700">Billing Address</CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 text-[11px] space-y-1">
                                <p className="text-slate-600 leading-tight">
                                    {masterVendor?.billing_address || 'N/A'}
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="shadow-sm border-slate-200 rounded-sm">
                            <CardHeader className="bg-slate-50 px-5 py-2 border-b border-slate-100">
                                <CardTitle className="text-sm font-bold text-center text-slate-700">Destination Address</CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 text-[11px] space-y-1">
                                <p className="text-slate-600 leading-tight">
                                    {masterVendor?.destination_address || 'N/A'}
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="bg-slate-50 p-4 rounded border border-slate-200">
                        <h3 className="text-sm font-bold text-slate-700 mb-2">Description</h3>
                        <p className="text-sm text-slate-600 italic">{firstItem.description || 'No additional description provided.'}</p>
                    </div>

                    {/* Items Table - Matches Create Tab Styling */}
                    <div className="border rounded-lg bg-white shadow-sm overflow-hidden mt-6">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-100/80">
                                    <TableHead className="h-10 text-xs font-bold text-slate-600 text-center w-16">Sr. No</TableHead>
                                    <TableHead className="h-10 text-xs font-bold text-slate-600">Product</TableHead>
                                    <TableHead className="h-10 text-xs font-bold text-slate-600">Description</TableHead>
                                    <TableHead className="h-10 text-xs font-bold text-slate-600 text-center">Qty</TableHead>
                                    <TableHead className="h-10 text-xs font-bold text-slate-600">Unit</TableHead>
                                    <TableHead className="h-10 text-xs font-bold text-indigo-600 text-right pr-8">Your Rate (₹)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {quotation.map((item, index) => (
                                    <TableRow key={index} className="hover:bg-slate-50 border-b last:border-0 transition-colors">
                                        <TableCell className="py-3 text-xs text-center text-slate-500 font-medium">{index + 1}</TableCell>
                                        <TableCell className="py-3 text-xs font-bold text-slate-900">{item.product}</TableCell>
                                        <TableCell className="py-3 text-xs text-slate-500 max-w-sm truncate">{item.description || '-'}</TableCell>
                                        <TableCell className="py-3 text-xs text-center font-bold text-slate-700">{item.qty}</TableCell>
                                        <TableCell className="py-3 text-xs text-slate-600">{item.unit}</TableCell>
                                        <TableCell className="py-3 pr-4">
                                            <div className="flex justify-end">
                                                <div className="relative w-32">
                                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">₹</span>
                                                    <Input
                                                        type="number"
                                                        placeholder="0.00"
                                                        className="h-8 text-xs pl-5 text-right font-bold border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-sm"
                                                        value={rates[item.indentNo] || ''}
                                                        onChange={(e) => handleRateChange(item.indentNo, e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-slate-100">
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                            <AlertCircle className="w-4 h-4 text-amber-500" />
                            <p>Rates should be exclusive of taxes and duties unless otherwise specified.</p>
                        </div>
                        <Button 
                            size="lg" 
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-11 px-8 rounded-sm shadow-md transition-all active:scale-95 disabled:opacity-50"
                            onClick={handleSubmit}
                            disabled={submitting}
                        >
                            {submitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Submitting...
                                </>
                            ) : (
                                'Submit Rates'
                            )}
                        </Button>
                    </div>
                </div>
                
                <footer className="text-center text-slate-400 text-[10px] uppercase tracking-widest pb-8">
                    <p>© {new Date().getFullYear()} {firstItem.firm}. Generated via Store Management System.</p>
                </footer>
            </div>
        </div>
    );
}
