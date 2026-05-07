import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

const styles = StyleSheet.create({
    page: {
        padding: 20,
        fontFamily: 'Helvetica',
        fontSize: 9,
        color: '#000000',
        backgroundColor: '#ffffff',
    },
    mainContainer: {
        border: '1 solid #000000',
    },
    headerContainer: {
        flexDirection: 'row',
        padding: 10,
        borderBottom: '1 solid #000000',
        alignItems: 'center',
    },
    logoContainer: {
        width: '30%',
    },
    logo: {
        width: 80,
        height: 50,
        objectFit: 'contain',
    },
    companyInfo: {
        width: '70%',
        textAlign: 'right',
    },
    companyName: {
        fontSize: 14,
        fontFamily: 'Helvetica-Bold',
        marginBottom: 4,
    },
    companyText: {
        fontSize: 8,
        marginBottom: 2,
    },
    poHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 8,
        borderBottom: '1 solid #000000',
        backgroundColor: '#f8fafc',
    },
    poNumber: {
        fontSize: 10,
        fontFamily: 'Helvetica-Bold',
    },
    poDate: {
        fontSize: 10,
        fontFamily: 'Helvetica-Bold',
    },
    splitSection: {
        flexDirection: 'row',
        borderBottom: '1 solid #000000',
    },
    leftCol: {
        width: '50%',
        padding: 8,
        borderRight: '1 solid #000000',
    },
    rightCol: {
        width: '50%',
        padding: 8,
    },
    sectionHeading: {
        fontSize: 9,
        fontFamily: 'Helvetica-Bold',
        marginBottom: 6,
        textTransform: 'uppercase',
        borderBottom: '1 solid #000000',
        paddingBottom: 2,
    },
    infoRow: {
        flexDirection: 'row',
        marginBottom: 3,
    },
    infoLabel: {
        width: '35%',
        fontSize: 8,
    },
    infoValue: {
        width: '65%',
        fontFamily: 'Helvetica-Bold',
        fontSize: 8,
    },
    commercialSection: {
        flexDirection: 'row',
        borderBottom: '1 solid #000000',
    },
    commercialBox: {
        width: '33.33%',
        padding: 8,
        borderRight: '1 solid #000000',
    },
    commercialBoxLast: {
        width: '33.33%',
        padding: 8,
    },
    commercialLabel: {
        fontSize: 8.5,
        fontFamily: 'Helvetica-Bold',
        marginBottom: 4,
    },
    commercialValue: {
        fontSize: 8,
        lineHeight: 1.2,
    },
    tableContainer: {
        marginTop: 0,
    },
    tableHeaderRow: {
        flexDirection: 'row',
        backgroundColor: '#e2e8f0',
        borderBottom: '1 solid #000000',
    },
    tableRow: {
        flexDirection: 'row',
        borderBottom: '1 solid #000000',
    },
    tableHeaderCell: {
        padding: 6,
        fontFamily: 'Helvetica-Bold',
        fontSize: 8,
        textAlign: 'center',
        borderRight: '1 solid #000000',
    },
    tableCell: {
        padding: 5,
        fontSize: 8,
        textAlign: 'center',
        borderRight: '1 solid #000000',
    },
    colSr: { width: '8%' },
    colInternal: { width: '15%' },
    colProduct: { width: '37%' },
    colQty: { width: '15%' },
    colUnit: { width: '10%' },
    colRate: { width: '15%' },
    
    rightAlign: { textAlign: 'right' },
    centerAlign: { textAlign: 'center' },
    leftAlign: { textAlign: 'left' },

    termsContainer: {
        marginTop: 10,
        padding: 8,
    },
    termRow: {
        flexDirection: 'row',
        marginBottom: 4,
    },
    termNumber: {
        width: '3%',
        fontSize: 8,
    },
    termText: {
        width: '97%',
        fontSize: 8,
    },
    signatureContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 40,
        padding: 20,
    },
    signatureBox: {
        width: '40%',
        borderTop: '1 solid #000000',
        textAlign: 'center',
        paddingTop: 5,
    }
});

export interface POPdfProps {
    companyName: string;
    companyPhone: string;
    companyGstin: string;
    companyPan: string;
    companyAddress: string;
    billingAddress: string;
    destinationAddress: string;
    supplierName: string;
    supplierAddress: string;
    supplierGstin: string;
    orderNumber: string;
    orderDate: string;
    quotationNumber: string;
    quotationDate: string;
    enqNo?: string;
    enqDate?: string;
    description?: string;
    items: {
        internalCode: string;
        product: string;
        description: string;
        quantity: number;
        unit: string;
        rate: number;
        gst: number;
        discount: number;
        amount: number;
    }[];
    total: number;
    gstAmount: number;
    grandTotal: number;
    terms: string[];
    preparedBy?: string;
    approvedBy?: string;
    logo?: string;
}

const QuotationPdf = (props: POPdfProps) => {
    const {
        companyName,
        companyPhone,
        companyGstin,
        companyPan,
        companyAddress,
        billingAddress,
        destinationAddress,
        supplierName,
        supplierAddress,
        supplierGstin,
        orderNumber,
        orderDate,
        quotationNumber,
        quotationDate,
        description,
        items,
        terms,
        logo
    } = props;

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                <View style={styles.mainContainer}>
                    <View style={styles.headerContainer}>
                        <View style={styles.logoContainer}>
                            {logo && <Image src={logo} style={styles.logo} />}
                        </View>
                        <View style={styles.companyInfo}>
                            <Text style={styles.companyName}>{companyName}</Text>
                            <Text style={styles.companyText}>{companyAddress}</Text>
                            <Text style={styles.companyText}>GSTIN: {companyGstin} | PAN: {companyPan}</Text>
                            <Text style={styles.companyText}>Phone: {companyPhone}</Text>
                        </View>
                    </View>

                    <View style={styles.poHeader}>
                        <Text style={styles.poNumber}>QUOTATION NO: {quotationNumber}</Text>
                        <Text style={styles.poDate}>DATE: {quotationDate}</Text>
                    </View>

                    <View style={styles.splitSection}>
                        <View style={styles.leftCol}>
                            <Text style={styles.sectionHeading}>To,</Text>
                            <Text style={styles.infoValue}>{supplierName}</Text>
                            <Text style={styles.companyText}>{supplierAddress}</Text>
                            <Text style={styles.companyText}>GSTIN: {supplierGstin}</Text>
                        </View>
                        <View style={styles.rightCol}>
                            <Text style={styles.sectionHeading}>Project Details:</Text>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Billing:</Text>
                                <Text style={styles.infoValue}>{billingAddress}</Text>
                            </View>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Destination:</Text>
                                <Text style={styles.infoValue}>{destinationAddress}</Text>
                            </View>
                        </View>
                    </View>

                    {description && (
                        <View style={{ padding: 8, borderBottom: '1 solid #000000' }}>
                            <Text style={styles.sectionHeading}>Description:</Text>
                            <Text style={styles.companyText}>{description}</Text>
                        </View>
                    )}

                    <View style={styles.tableContainer}>
                        <View style={styles.tableHeaderRow}>
                            <Text style={[styles.tableHeaderCell, styles.colSr]}>SR.</Text>
                            <Text style={[styles.tableHeaderCell, styles.colInternal]}>INDENT NO</Text>
                            <Text style={[styles.tableHeaderCell, styles.colProduct]}>PRODUCT / DESCRIPTION</Text>
                            <Text style={[styles.tableHeaderCell, styles.colQty]}>QTY</Text>
                            <Text style={[styles.tableHeaderCell, styles.colUnit]}>UNIT</Text>
                            <Text style={[styles.tableHeaderCell, styles.colRate]}>REMARKS</Text>
                        </View>

                        {items.map((item, index) => (
                            <View key={index} style={styles.tableRow}>
                                <Text style={[styles.tableCell, styles.colSr]}>{index + 1}</Text>
                                <Text style={[styles.tableCell, styles.colInternal]}>{item.internalCode}</Text>
                                <View style={[styles.tableCell, styles.colProduct, { textAlign: 'left' }]}>
                                    <Text style={{ fontFamily: 'Helvetica-Bold' }}>{item.product}</Text>
                                    <Text style={{ fontSize: 7, color: '#666' }}>{item.description}</Text>
                                </View>
                                <Text style={[styles.tableCell, styles.colQty]}>{item.quantity}</Text>
                                <Text style={[styles.tableCell, styles.colUnit]}>{item.unit}</Text>
                                <Text style={[styles.tableCell, styles.colRate]}>-</Text>
                            </View>
                        ))}
                    </View>

                    <View style={styles.termsContainer}>
                        <Text style={[styles.sectionHeading, { borderBottom: 0 }]}>Terms & Conditions:</Text>
                        {terms.map((term, index) => (
                            <View key={index} style={styles.termRow}>
                                <Text style={styles.termNumber}>{index + 1}.</Text>
                                <Text style={styles.termText}>{term}</Text>
                            </View>
                        ))}
                    </View>

                    <View style={styles.signatureContainer}>
                        <View style={styles.signatureBox}>
                            <Text style={styles.companyText}>Prepared By</Text>
                        </View>
                        <View style={styles.signatureBox}>
                            <Text style={styles.companyText}>Authorized Signatory</Text>
                        </View>
                    </View>
                </View>
            </Page>
        </Document>
    );
};

export default QuotationPdf;
