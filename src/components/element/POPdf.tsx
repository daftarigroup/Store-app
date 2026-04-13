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
        marginTop: 4,
    },
    tableHeaderRow: {
        flexDirection: 'row',
        backgroundColor: '#e2e8f0',
        borderBottom: '1 solid #000000',
        borderTop: '1 solid #000000',
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
    colSr: { width: '5%' },
    colMaterial: { width: '20%' },
    colHsn: { width: '10%' },
    colUnit: { width: '6%' },
    colQuantity: { width: '8%' },
    colRate: { width: '10%' },
    colAmount: { width: '10%' },
    colTotalAmount: { width: '15%' },
    rightAlign: { textAlign: 'right' },
    centerAlign: { textAlign: 'center' },
    leftAlign: { textAlign: 'left' },

    totalSection: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        borderBottom: '1 solid #000000',
        padding: 6,
    },
    totalBox: {
        width: '30%',
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: '4 8',
    },
    totalLabel: {
        fontFamily: 'Helvetica-Bold',
        fontSize: 8.5,
    },
    totalValue: {
        fontFamily: 'Helvetica-Bold',
        fontSize: 8.5,
    },
    termsContainer: {
        borderTop: '1 solid #000000',
    },
    termRow: {
        flexDirection: 'row',
        borderBottom: '1 solid #000000',
        padding: 4,
    },
    termNumber: {
        width: '5%',
        paddingLeft: 4,
        fontSize: 8,
        fontFamily: 'Helvetica-Bold',
    },
    termText: {
        width: '95%',
        fontSize: 8,
        lineHeight: 1.3,
    },
    signatureContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        padding: 12,
        borderBottom: '1 solid #000000',
    },
    signatureLeft: {
        width: '50%',
    },
    signatureRight: {
        width: '50%',
        alignItems: 'flex-end',
    },
    forText: {
        fontSize: 10,
        fontFamily: 'Helvetica-Bold',
        marginBottom: 30,
    },
    signText: {
        fontSize: 10,
        fontFamily: 'Helvetica-Bold',
        marginBottom: 30,
    },
    stampText: {
        fontSize: 9,
        fontFamily: 'Helvetica',
        fontStyle: 'italic',
    },
    lineContainer: {
        marginTop: 4,
    },
    signLine: {
        width: 200,
        borderTop: '1 solid #000000',
        marginTop: 4,
    },
    stampLine: {
        width: 150,
        borderTop: '1 solid #000000',
        marginTop: 4,
    },
});

interface Item {
    materialName: string;
    hsnCode: string;
    unit: string;
    quantity: number;
    unitRate: number;
    totalAmount: number;
}

export interface POPdfProps {
    poNumber: string;
    poDate: string;
    supplierName: string;
    supplierAddress: string;
    supplierGstin: string;
    supplierContactPerson: string;
    supplierPhone: string;
    supplierEmail: string;
    projectName: string;
    deliveryAddress: string;
    deliveryContactPerson: string;
    deliveryPhone: string;
    deliveryEmail: string;
    items: Item[];
    totalAmount: number;
    logo?: string;
    authorizedSignatory?: string;
    companyName: string;
    companyAddress: string;
    companyPhone: string;
    companyEmail: string;
    companyGstin: string;
    terms: { num: string; text: string }[];
}

export default function PoojaPOFormat(props: POPdfProps) {
    const {
        poNumber,
        poDate,
        supplierName,
        supplierAddress,
        supplierGstin,
        supplierContactPerson,
        supplierPhone,
        supplierEmail,
        projectName,
        deliveryAddress,
        deliveryContactPerson,
        deliveryPhone,
        deliveryEmail,
        items,
        totalAmount,
        logo,
        authorizedSignatory = "Authorized Signatory",
        companyName,
        companyAddress,
        companyPhone,
        companyEmail,
        companyGstin,
        terms
    } = props;

    const formatCurrency = (amount: number) => {
        return amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                <View style={styles.mainContainer}>

                    {/* Header */}
                    <View style={styles.headerContainer}>
                        <View style={styles.logoContainer}>
                            {logo && <Image src={logo} style={styles.logo} />}
                        </View>
                        <View style={styles.companyInfo}>
                            <Text style={styles.companyName}>{companyName}</Text>
                            <Text style={styles.companyText}>{companyAddress}</Text>
                            {companyPhone && <Text style={styles.companyText}>Phone: {companyPhone}</Text>}
                            {companyEmail && <Text style={styles.companyText}>Email: {companyEmail}</Text>}
                        </View>
                    </View>

                    {/* PO Number and Date */}
                    <View style={styles.poHeader}>
                        <Text style={styles.poNumber}>P.O. No.: {poNumber}</Text>
                        <Text style={styles.poDate}>P.O. Date : {poDate}</Text>
                    </View>

                    {/* Supplier and Contact Details */}
                    <View style={styles.splitSection}>
                        <View style={styles.leftCol}>
                            <Text style={styles.sectionHeading}>Supplier's Details:</Text>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Company Name:</Text>
                                <Text style={styles.infoValue}>{supplierName}</Text>
                            </View>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Address:</Text>
                                <Text style={styles.infoValue}>{supplierAddress}</Text>
                            </View>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>GSTIN:</Text>
                                <Text style={styles.infoValue}>{supplierGstin}</Text>
                            </View>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Contact Person:</Text>
                                <Text style={styles.infoValue}>{supplierContactPerson}</Text>
                            </View>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Phone Number:</Text>
                                <Text style={styles.infoValue}>{supplierPhone}</Text>
                            </View>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Email Id:</Text>
                                <Text style={styles.infoValue}>{supplierEmail}</Text>
                            </View>
                        </View>
                        <View style={styles.rightCol}>
                            <Text style={styles.sectionHeading}>Contact Details:</Text>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Company Name:</Text>
                                <Text style={styles.infoValue}>{companyName}</Text>
                            </View>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Billing Address:</Text>
                                <Text style={styles.infoValue}>{companyAddress}</Text>
                            </View>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>GSTIN:</Text>
                                <Text style={styles.infoValue}>{companyGstin}</Text>
                            </View>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Contact Person:</Text>
                                <Text style={styles.infoValue}>Mr. Pratik Daftari</Text>
                            </View>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Phone Number:</Text>
                                <Text style={styles.infoValue}>9923608888</Text>
                            </View>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Email Id:</Text>
                                <Text style={styles.infoValue}>Daftarigroup@gmail.com</Text>
                            </View>
                        </View>
                    </View>

                    {/* Project and Delivery */}
                    <View style={styles.commercialSection}>
                        <View style={styles.commercialBox}>
                            <Text style={styles.commercialLabel}>Project Name:</Text>
                            <Text style={styles.commercialValue}>{projectName}</Text>
                        </View>
                        <View style={styles.commercialBox}>
                            <Text style={styles.commercialLabel}>Delivery Address:</Text>
                            <Text style={styles.commercialValue}>{deliveryAddress}</Text>
                        </View>
                        <View style={styles.commercialBoxLast}>
                            <Text style={styles.commercialLabel}>Contact Person:</Text>
                            <Text style={styles.commercialValue}>{deliveryContactPerson}</Text>
                            <Text style={styles.commercialLabel}>Phone Number:</Text>
                            <Text style={styles.commercialValue}>{deliveryPhone}</Text>
                            <Text style={styles.commercialLabel}>Email Id:</Text>
                            <Text style={styles.commercialValue}>{deliveryEmail}</Text>
                        </View>
                    </View>

                    {/* Purchase Order Details Table */}
                    <View style={styles.tableContainer}>
                        <Text style={[styles.sectionHeading, { marginHorizontal: 8, marginTop: 8 }]}>Purchase Order Details:</Text>

                        <View style={styles.tableHeaderRow}>
                            <Text style={[styles.tableHeaderCell, styles.colSr]}>Sr. No</Text>
                            <Text style={[styles.tableHeaderCell, styles.colMaterial]}>Material Name/Code</Text>
                            <Text style={[styles.tableHeaderCell, styles.colHsn]}>HSN Code</Text>
                            <Text style={[styles.tableHeaderCell, styles.colUnit]}>Unit</Text>
                            <Text style={[styles.tableHeaderCell, styles.colQuantity]}>Quantity</Text>
                            <Text style={[styles.tableHeaderCell, styles.colRate]}>Unit Rate</Text>
                            <Text style={[styles.tableHeaderCell, styles.colAmount]}>Amount (₹)</Text>
                            <Text style={[styles.tableHeaderCell, styles.colTotalAmount]}>Total Amount (₹)</Text>
                        </View>

                        {items.map((item, index) => (
                            <View style={styles.tableRow} key={index}>
                                <Text style={[styles.tableCell, styles.colSr]}>{index + 1}</Text>
                                <Text style={[styles.tableCell, styles.colMaterial]}>{item.materialName}</Text>
                                <Text style={[styles.tableCell, styles.colHsn]}>{item.hsnCode}</Text>
                                <Text style={[styles.tableCell, styles.colUnit]}>{item.unit}</Text>
                                <Text style={[styles.tableCell, styles.colQuantity, styles.rightAlign]}>{item.quantity}</Text>
                                <Text style={[styles.tableCell, styles.colRate, styles.rightAlign]}>{formatCurrency(item.unitRate)}</Text>
                                <Text style={[styles.tableCell, styles.colAmount, styles.rightAlign]}>{formatCurrency(item.unitRate * item.quantity)}</Text>
                                <Text style={[styles.tableCell, styles.colTotalAmount, styles.rightAlign]}>{formatCurrency(item.totalAmount)}</Text>
                            </View>
                        ))}
                    </View>

                    {/* Total */}
                    <View style={styles.totalSection}>
                        <View style={styles.totalBox}>
                            <View style={styles.totalRow}>
                                <Text style={styles.totalLabel}>Total Amount (₹):</Text>
                                <Text style={styles.totalValue}>{formatCurrency(totalAmount)}</Text>
                            </View>
                        </View>
                    </View>

                    {/* Terms and Conditions */}
                    <View style={styles.termsContainer}>
                        {terms && terms.map((term, idx) => (
                            <View style={styles.termRow} key={idx}>
                                <Text style={styles.termNumber}>{term.num}</Text>
                                <Text style={styles.termText}>{term.text}</Text>
                            </View>
                        ))}
                    </View>

                    {/* Signature Section with Space for Sign and Seal */}
                    <View style={styles.signatureContainer}>
                        <View style={styles.signatureLeft}>
                            <Text style={styles.forText}>For, Pooja Constructions</Text>
                            <View style={styles.lineContainer}>
                                <View style={styles.signLine} />
                                <Text style={styles.stampText}>{authorizedSignatory}</Text>
                            </View>
                        </View>
                        <View style={styles.signatureRight}>
                            <Text style={styles.signText}>Authorized Signatory</Text>
                            <View style={styles.lineContainer}>
                                <View style={styles.stampLine} />
                                <Text style={styles.stampText}>(Seal & Stamp)</Text>
                            </View>
                        </View>
                    </View>

                </View>
            </Page>
        </Document>
    );
}