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
    colMain: { width: '45%' },
    colQty: { width: '15%', textAlign: 'center' },
    colUom: { width: '10%' },
    colDept: { width: '25%' },
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
}

export interface IssuePdfProps {
    type: 'issue' | 'return';
    issueNumber: string;
    date: string;
    constructorName: string;
    siteLocation: string;
    projectName: string;
    remarks?: string;
    issuePersonName?: string;
    returnPersonName?: string;
    damageRemark?: string;
    rejectedDamageQty?: number;
    products: Product[];
    logo?: string;
}

const IssuePdf = ({
    type,
    issueNumber,
    date,
    constructorName,
    siteLocation,
    projectName,
    remarks,
    issuePersonName,
    returnPersonName,
    damageRemark,
    rejectedDamageQty,
    products,
    logo
}: IssuePdfProps) => {
    const isReturn = type === 'return';
    
    return (
        <Document>
            {/* Page 1: Original Copy */}
            <Page size="A4" style={styles.page}>
                <View style={{ position: 'absolute', top: 20, right: 30 }}>
                    <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#94a3b8' }}>ORIGINAL COPY</Text>
                </View>

                {logo && (
                    <View style={styles.logoContainer}>
                        <Image src={logo} style={styles.logo} />
                    </View>
                )}

                <View style={styles.header}>
                    <Text style={styles.title}>{isReturn ? 'STORE RETURN SLIP' : 'STORE ISSUE SLIP'}</Text>
                    <Text style={styles.subtitle}>{isReturn ? 'Material Return Confirmation' : 'Material Issue Note'}</Text>
                </View>

                <View style={styles.infoGrid}>
                    <View style={styles.infoItem}>
                        <Text style={styles.label}>ISSUE NUMBER</Text>
                        <Text style={styles.value}>{issueNumber}</Text>
                    </View>
                    <View style={styles.infoItem}>
                        <Text style={styles.label}>DATE</Text>
                        <Text style={styles.value}>{date}</Text>
                    </View>
                    <View style={styles.infoItem}>
                        <Text style={styles.label}>PROJECT NAME</Text>
                        <Text style={styles.value}>{projectName}</Text>
                    </View>
                    <View style={styles.infoItem}>
                        <Text style={styles.label}>SITE LOCATION</Text>
                        <Text style={styles.value}>{siteLocation}</Text>
                    </View>
                    <View style={styles.infoItem}>
                        <Text style={styles.label}>CONTRACTOR NAME</Text>
                        <Text style={styles.value}>{constructorName}</Text>
                    </View>
                    <View style={styles.infoItem}>
                        <Text style={styles.label}>{isReturn ? 'RETURN PERSON' : 'ISSUE PERSON'}</Text>
                        <Text style={styles.value}>{isReturn ? returnPersonName : issuePersonName || '-'}</Text>
                    </View>
                    
                    {remarks && (
                        <View style={[styles.infoItem, { width: '100%', marginTop: 5 }]}>
                            <Text style={styles.label}>ISSUE REMARKS</Text>
                            <Text style={styles.value}>{remarks}</Text>
                        </View>
                    )}

                    {isReturn && (
                        <>
                            <View style={[styles.infoItem, { width: '50%', marginTop: 5 }]}>
                                <Text style={styles.label}>REJECTED / DAMAGE QTY</Text>
                                <Text style={[styles.value, { color: '#ef4444' }]}>{rejectedDamageQty || 0}</Text>
                            </View>
                            <View style={[styles.infoItem, { width: '100%', marginTop: 5 }]}>
                                <Text style={styles.label}>DAMAGE REMARK</Text>
                                <Text style={styles.value}>{damageRemark || '-'}</Text>
                            </View>
                        </>
                    )}
                </View>

                <View style={styles.table}>
                    <View style={styles.tableHeader}>
                        <Text style={styles.colSr}>#</Text>
                        <Text style={styles.colMain}>MATERIAL / PRODUCT</Text>
                        <Text style={styles.colQty}>{isReturn ? 'RETURN QTY' : 'ISSUE QTY'}</Text>
                        <Text style={styles.colUom}>UOM</Text>
                        <Text style={styles.colDept}>DEPARTMENT</Text>
                    </View>

                    {products.map((p, i) => (
                        <View key={i} style={styles.tableRow}>
                            <Text style={styles.colSr}>{i + 1}</Text>
                            <View style={styles.colMain}>
                                <Text style={{ fontFamily: 'Helvetica-Bold' }}>{p.productName}</Text>
                                <Text style={styles.specText}>Group: {p.groupHead}</Text>
                            </View>
                            <Text style={styles.colQty}>{p.quantity}</Text>
                            <Text style={styles.colUom}>{p.uom}</Text>
                            <Text style={styles.colDept}>{p.department}</Text>
                        </View>
                    ))}
                </View>

                <Text style={styles.footer}>
                    This is a computer generated slip created by botivate.in. Transaction ID: {issueNumber}
                </Text>
            </Page>

            {/* Page 2: Duplicate Copy */}
            <Page size="A4" style={styles.page}>
                <View style={{ position: 'absolute', top: 20, right: 30 }}>
                    <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#94a3b8' }}>DUPLICATE COPY</Text>
                </View>

                {logo && (
                    <View style={styles.logoContainer}>
                        <Image src={logo} style={styles.logo} />
                    </View>
                )}

                <View style={styles.header}>
                    <Text style={styles.title}>{isReturn ? 'STORE RETURN SLIP' : 'STORE ISSUE SLIP'}</Text>
                    <Text style={styles.subtitle}>{isReturn ? 'Material Return Confirmation' : 'Material Issue Note'}</Text>
                </View>

                <View style={styles.infoGrid}>
                    <View style={styles.infoItem}>
                        <Text style={styles.label}>ISSUE NUMBER</Text>
                        <Text style={styles.value}>{issueNumber}</Text>
                    </View>
                    <View style={styles.infoItem}>
                        <Text style={styles.label}>DATE</Text>
                        <Text style={styles.value}>{date}</Text>
                    </View>
                    <View style={styles.infoItem}>
                        <Text style={styles.label}>PROJECT NAME</Text>
                        <Text style={styles.value}>{projectName}</Text>
                    </View>
                    <View style={styles.infoItem}>
                        <Text style={styles.label}>SITE LOCATION</Text>
                        <Text style={styles.value}>{siteLocation}</Text>
                    </View>
                    <View style={styles.infoItem}>
                        <Text style={styles.label}>CONTRACTOR NAME</Text>
                        <Text style={styles.value}>{constructorName}</Text>
                    </View>
                    <View style={styles.infoItem}>
                        <Text style={styles.label}>{isReturn ? 'RETURN PERSON' : 'ISSUE PERSON'}</Text>
                        <Text style={styles.value}>{isReturn ? returnPersonName : issuePersonName || '-'}</Text>
                    </View>
                    
                    {remarks && (
                        <View style={[styles.infoItem, { width: '100%', marginTop: 5 }]}>
                            <Text style={styles.label}>ISSUE REMARKS</Text>
                            <Text style={styles.value}>{remarks}</Text>
                        </View>
                    )}

                    {isReturn && (
                        <>
                            <View style={[styles.infoItem, { width: '50%', marginTop: 5 }]}>
                                <Text style={styles.label}>REJECTED / DAMAGE QTY</Text>
                                <Text style={[styles.value, { color: '#ef4444' }]}>{rejectedDamageQty || 0}</Text>
                            </View>
                            <View style={[styles.infoItem, { width: '100%', marginTop: 5 }]}>
                                <Text style={styles.label}>DAMAGE REMARK</Text>
                                <Text style={styles.value}>{damageRemark || '-'}</Text>
                            </View>
                        </>
                    )}
                </View>

                <View style={styles.table}>
                    <View style={styles.tableHeader}>
                        <Text style={styles.colSr}>#</Text>
                        <Text style={styles.colMain}>MATERIAL / PRODUCT</Text>
                        <Text style={styles.colQty}>{isReturn ? 'RETURN QTY' : 'ISSUE QTY'}</Text>
                        <Text style={styles.colUom}>UOM</Text>
                        <Text style={styles.colDept}>DEPARTMENT</Text>
                    </View>

                    {products.map((p, i) => (
                        <View key={i} style={styles.tableRow}>
                            <Text style={styles.colSr}>{i + 1}</Text>
                            <View style={styles.colMain}>
                                <Text style={{ fontFamily: 'Helvetica-Bold' }}>{p.productName}</Text>
                                <Text style={styles.specText}>Group: {p.groupHead}</Text>
                            </View>
                            <Text style={styles.colQty}>{p.quantity}</Text>
                            <Text style={styles.colUom}>{p.uom}</Text>
                            <Text style={styles.colDept}>{p.department}</Text>
                        </View>
                    ))}
                </View>

                <Text style={styles.footer}>
                    This is a computer generated slip created by botivate.in. Transaction ID: {issueNumber}
                </Text>
            </Page>
        </Document>
    );
};

export default IssuePdf;
