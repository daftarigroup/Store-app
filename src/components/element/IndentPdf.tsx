import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

const styles = StyleSheet.create({
    page: {
        padding: 30,
        fontFamily: 'Helvetica',
        fontSize: 10,
        color: '#333',
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 10,
    },
    logo: {
        width: 150,
        height: 60,
        objectFit: 'contain',
    },
    header: {
        marginBottom: 20,
        borderBottom: '2 solid #4f46e5',
        paddingBottom: 10,
        alignItems: 'center',
    },
    title: {
        fontSize: 20,
        fontFamily: 'Helvetica-Bold',
        color: '#4f46e5',
        textAlign: 'center',
        marginBottom: 5,
    },
    subtitle: {
        fontSize: 10,
        textAlign: 'center',
        color: '#666',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    infoGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 20,
        backgroundColor: '#f8fafc',
        padding: 15,
        borderRadius: 5,
    },
    infoItem: {
        width: '50%',
        marginBottom: 8,
    },
    label: {
        fontFamily: 'Helvetica-Bold',
        fontSize: 9,
        color: '#64748b',
        marginBottom: 2,
    },
    value: {
        fontSize: 11,
        color: '#1e293b',
    },
    table: {
        marginTop: 10,
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#4f46e5',
        color: '#ffffff',
        padding: 8,
        fontFamily: 'Helvetica-Bold',
        fontSize: 9,
    },
    tableRow: {
        flexDirection: 'row',
        borderBottom: '1 solid #e2e8f0',
        padding: 8,
        alignItems: 'center',
    },
    colSr: { width: '5%', textAlign: 'center' },
    colMain: { width: '35%' },
    colQty: { width: '10%', textAlign: 'center' },
    colUom: { width: '10%' },
    colDept: { width: '15%' },
    colDate: { width: '25%' },
    specText: {
        fontSize: 8,
        color: '#64748b',
        marginTop: 2,
    },
    footer: {
        position: 'absolute',
        bottom: 30,
        left: 30,
        right: 30,
        borderTop: '1 solid #e2e8f0',
        paddingTop: 10,
        textAlign: 'center',
        fontSize: 8,
        color: '#94a3b8',
    }
});

interface Product {
    productName: string;
    groupHead: string;
    department: string;
    quantity: number;
    uom: string;
    expectedRequirementDate: string;
    specifications?: string;
    areaOfUse?: string;
}

export interface IndentPdfProps {
    indentNumber: string;
    indenterName: string;
    firmName: string;
    indentStatus: string;
    date: string;
    products: Product[];
    logo?: string;
}

const IndentPdf = ({ indentNumber, indenterName, firmName, indentStatus, date, products, logo }: IndentPdfProps) => (
    <Document>
        <Page size="A4" style={styles.page}>
            {logo && (
                <View style={styles.logoContainer}>
                    <Image src={logo} style={styles.logo} />
                </View>
            )}
            <View style={styles.header}>
                <Text style={styles.title}>PURCHASE INDENT</Text>
                <Text style={styles.subtitle}>Material Requisition Note</Text>
            </View>

            <View style={styles.infoGrid}>
                <View style={styles.infoItem}>
                    <Text style={styles.label}>INDENT NUMBER</Text>
                    <Text style={styles.value}>{indentNumber}</Text>
                </View>
                <View style={styles.infoItem}>
                    <Text style={styles.label}>DATE</Text>
                    <Text style={styles.value}>{date}</Text>
                </View>
                <View style={styles.infoItem}>
                    <Text style={styles.label}>PROJECT / FIRM</Text>
                    <Text style={styles.value}>{firmName}</Text>
                </View>
                <View style={styles.infoItem}>
                    <Text style={styles.label}>INDENTER NAME</Text>
                    <Text style={styles.value}>{indenterName}</Text>
                </View>
                <View style={styles.infoItem}>
                    <Text style={styles.label}>PRIORITY STATUS</Text>
                    <Text style={[styles.value, { color: indentStatus === 'Critical' ? '#ef4444' : '#1e293b' }]}>
                        {indentStatus}
                    </Text>
                </View>
            </View>

            <View style={styles.table}>
                <View style={styles.tableHeader}>
                    <Text style={styles.colSr}>#</Text>
                    <Text style={styles.colMain}>MATERIAL / DESCRIPTION</Text>
                    <Text style={styles.colQty}>QTY</Text>
                    <Text style={styles.colUom}>UOM</Text>
                    <Text style={styles.colDept}>DEPT</Text>
                    <Text style={styles.colDate}>EXPECTED DATE</Text>
                </View>

                {products.map((p, i) => (
                    <View key={i} style={styles.tableRow}>
                        <Text style={styles.colSr}>{i + 1}</Text>
                        <View style={styles.colMain}>
                            <Text style={{ fontFamily: 'Helvetica-Bold' }}>{p.productName}</Text>
                            <Text style={styles.specText}>Group: {p.groupHead}</Text>
                            {p.specifications && <Text style={styles.specText}>Specs: {p.specifications}</Text>}
                            {p.areaOfUse && <Text style={styles.specText}>Area: {p.areaOfUse}</Text>}
                        </View>
                        <Text style={styles.colQty}>{p.quantity}</Text>
                        <Text style={styles.colUom}>{p.uom}</Text>
                        <Text style={styles.colDept}>{p.department}</Text>
                        <Text style={styles.colDate}>{p.expectedRequirementDate}</Text>
                    </View>
                ))}
            </View>

            <Text style={styles.footer}>
                This is a computer generated indent created on {date} by botivate.in. Indent Number: {indentNumber}
            </Text>
        </Page>
    </Document>
);

export default IndentPdf;
