import React from 'react';
import { Document, Page, Text, View, StyleSheet, pdf, Image } from '@react-pdf/renderer';
import godspeedLogo from '../assets/logos/godspped-logo-fulllength.png';

// Color scheme
const colors = {
  primary: '#ffd500',
  secondary: '#002644',
  text: '#1f2937',
  border: '#e5e7eb',
  accent: '#3b82f6',
};

// Styles for the PDF
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    padding: 30,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  logoSection: {
    flexDirection: 'column',
    width: '40%',
    justifyContent: 'center',
  },
  logoPlaceholder: {
    width: 185,
    height: 40,
    objectFit: 'contain',
  },
  companyInfo: {
    flexDirection: 'column',
    width: '55%',
    alignItems: 'flex-end',
  },
  companyDetails: {
    fontSize: 10,
    color: colors.text,
    lineHeight: 1.4,
    textAlign: 'right',
  },
  invoiceInfo: {
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  invoiceTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 10,
  },
  invoiceNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  invoiceDate: {
    fontSize: 10,
    color: colors.secondary,
  },
  billToInvoiceSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  clientSection: {
    width: '48%',
    padding: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 5,
  },
  invoiceDetailsSection: {
    width: '48%',
    padding: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 5,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 10,
  },
  clientName: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  clientDetails: {
    fontSize: 10,
    color: colors.text,
    lineHeight: 1.4,
  },
  invoiceDetailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  invoiceDetailLabel: {
    fontSize: 10,
    color: colors.text,
    fontWeight: 'bold',
  },
  invoiceDetailValue: {
    fontSize: 10,
    color: colors.text,
  },
  table: {
    display: 'flex',
    width: 'auto',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  tableRow: {
    margin: 'auto',
    flexDirection: 'row',
  },
  tableHeader: {
    backgroundColor: colors.primary,
    color: 'white',
    fontWeight: 'bold',
  },
  tableCol: {
    width: '20%',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: colors.border,
    borderTopWidth: 0,
    borderLeftWidth: 0,
  },
  tableCell: {
    margin: 'auto',
    marginTop: 5,
    marginBottom: 5,
    fontSize: 9,
    padding: 5,
  },
  tableCellHeader: {
    margin: 'auto',
    marginTop: 4,
    marginBottom: 4,
    fontSize: 10,
    fontWeight: 'bold',
    padding: 2,
    color: colors.secondary,
  },
  summarySection: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingBottom: 10,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    width: '100%',
  },
  summaryTable: {
    width: '40%',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  summaryLabel: {
    fontSize: 10,
    color: colors.text,
  },
  summaryValue: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  totalRow: {
    backgroundColor: colors.primary,
    color: 'white',
    fontWeight: 'bold',
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 30,
    right: 30,
    fontSize: 8,
    color: colors.secondary,
  },
  footerContent: {
    textAlign: 'center',
    marginBottom: 5,
  },
  footerMessage: {
    fontSize: 8,
    color: colors.text,
    marginBottom: 5,
    textAlign: 'left',
  },
  footerTerms: {
    fontSize: 8,
    color: colors.text,
    marginBottom: 5,
    textAlign: 'left',
  },
  pageNumber: {
    position: 'absolute',
    bottom: 20,
    left: 30,
    right: 30,
    fontSize: 8,
    color: colors.secondary,
    textAlign: 'right',
  },
  pageNumberText: {
    fontSize: 8,
    color: colors.secondary,
  },
});

// Company information
const COMPANY_INFO = {
  name: '9084380 Canada Inc. O/A Godspeed Group',
  address: '240 Humberline Dr',
  address2: 'Etobicoke ON, M9W 5X1',
  gst: 'GST/HST No. 825183387',
};

// Interfaces
export interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  client: {
    companyName: string;
    address?: string[];
    email?: string;
  };
  lineItems: Array<{
    positionName?: string;
    description: string;
    candidate?: string;
    hours: number;
    rate: number;
    taxType: string;
    amount: number;
  }>;
  summary: {
    subtotal: number;
    totalHST: number;
    totalGST: number;
    totalQST: number;
    totalTax: number;
    grandTotal: number;
    totalHours: number;
    // Add tax percentage information
    hstPercentage?: number;
    gstPercentage?: number;
    qstPercentage?: number;
  };
  dateRange: {
    startDate: string;
    endDate: string;
  };
  terms: string;
  messageOnInvoice?: string;
  termsOnInvoice?: string;
}

// PDF Document Component
const InvoicePDFDocument: React.FC<{ data: InvoiceData }> = ({ data }) => {
  // Calculate how many rows can fit on the first page (accounting for header space)
  const FIRST_PAGE_ROWS = 12;
  // Calculate how many rows can fit on continuation pages (more space available)
  const CONTINUATION_PAGE_ROWS = 18;
  
  // Calculate pagination
  const pages: Array<{ items: typeof data.lineItems; isLastPage: boolean }> = [];
  let remainingItems = [...data.lineItems];
  let isFirstPage = true;
  
  while (remainingItems.length > 0) {
    const rowsForThisPage = isFirstPage ? FIRST_PAGE_ROWS : CONTINUATION_PAGE_ROWS;
    const itemsForThisPage = remainingItems.slice(0, rowsForThisPage);
    remainingItems = remainingItems.slice(rowsForThisPage);
    
    // Check if this should be the last page (if remaining items can fit on next page with summary)
    const isLastPage = remainingItems.length === 0 || 
                      (remainingItems.length <= (CONTINUATION_PAGE_ROWS - 8)); // Reserve space for summary
    
    pages.push({
      items: itemsForThisPage,
      isLastPage: isLastPage && remainingItems.length === 0
    });
    
    isFirstPage = false;
  }
  
  const totalPages = pages.length;
  
  return (
    <Document>
      {pages.map((page, pageIndex) => (
        <Page key={pageIndex} size="A4" style={styles.page}>
          {/* Header - only on first page */}
          {pageIndex === 0 && (
            <>
              <View style={styles.header}>
                <View style={styles.logoSection}>
                  <Image
                    src={godspeedLogo}
                    style={styles.logoPlaceholder}
                  />
                </View>
                <View style={styles.companyInfo}>
                  <Text style={styles.companyDetails}>
                    {COMPANY_INFO.name}{'\n'}
                    {COMPANY_INFO.address}{'\n'}
                    {COMPANY_INFO.address2}{'\n'}
                    {COMPANY_INFO.gst}
                  </Text>
                </View>
              </View>

              {/* Bill To and Invoice Details Section */}
              <View style={styles.billToInvoiceSection}>
                <View style={styles.clientSection}>
                  <Text style={styles.sectionTitle}>Bill To:</Text>
                  <Text style={styles.clientName}>{data.client.companyName}</Text>
                  {data.client.address && (
                    <Text style={styles.clientDetails}>
                      {data.client.address.join('\n')}
                    </Text>
                  )}
                  {data.client.email && (
                    <Text style={styles.clientDetails}>{data.client.email}</Text>
                  )}
                </View>
                
                <View style={styles.invoiceDetailsSection}>
                  <Text style={styles.sectionTitle}>Invoice Details:</Text>
                  <View style={styles.invoiceDetailItem}>
                    <Text style={styles.invoiceDetailLabel}>Invoice #:</Text>
                    <Text style={styles.invoiceDetailValue}>{data.invoiceNumber}</Text>
                  </View>
                  <View style={styles.invoiceDetailItem}>
                    <Text style={styles.invoiceDetailLabel}>Invoice Date:</Text>
                    <Text style={styles.invoiceDetailValue}>{new Date(data.invoiceDate).toLocaleDateString()}</Text>
                  </View>
                  <View style={styles.invoiceDetailItem}>
                    <Text style={styles.invoiceDetailLabel}>Due Date:</Text>
                    <Text style={styles.invoiceDetailValue}>{new Date(data.dueDate).toLocaleDateString()}</Text>
                  </View>
                  <View style={styles.invoiceDetailItem}>
                    <Text style={styles.invoiceDetailLabel}>Term:</Text>
                    <Text style={styles.invoiceDetailValue}>
                      {data.terms}
                    </Text>
                  </View>
                </View>
              </View>
            </>
          )}

          {/* Line Items Table */}
          <View style={styles.table}>
            {/* Table Header */}
            <View style={[styles.tableRow, styles.tableHeader]}>
              <View style={[styles.tableCol, { width: '25%' }]}>
                <Text style={styles.tableCellHeader}>Position Name</Text>
              </View>
              <View style={[styles.tableCol, { width: '20%' }]}>
                <Text style={styles.tableCellHeader}>Candidate</Text>
              </View>
              <View style={[styles.tableCol, { width: '25%' }]}>
                <Text style={styles.tableCellHeader}>Description</Text>
              </View>
              <View style={[styles.tableCol, { width: '10%' }]}>
                <Text style={styles.tableCellHeader}>Hours</Text>
              </View>
              <View style={[styles.tableCol, { width: '10%' }]}>
                <Text style={styles.tableCellHeader}>Rate</Text>
              </View>
              <View style={[styles.tableCol, { width: '10%' }]}>
                <Text style={styles.tableCellHeader}>Amount</Text>
              </View>
            </View>

            {/* Table Rows for this page */}
            {page.items.map((item, index) => (
              <View style={styles.tableRow} key={index}>
                <View style={[styles.tableCol, { width: '25%' }]}>
                  <Text style={styles.tableCell}>
                    {item.positionName || 'N/A'}
                  </Text>
                </View>
                <View style={[styles.tableCol, { width: '20%' }]}>
                  <Text style={styles.tableCell}>
                    {item.candidate || 'N/A'}
                  </Text>
                </View>
                <View style={[styles.tableCol, { width: '25%' }]}>
                  <Text style={styles.tableCell}>
                    {item.description || 'N/A'}
                  </Text>
                </View>
                <View style={[styles.tableCol, { width: '10%' }]}>
                  <Text style={styles.tableCell}>{item.hours.toFixed(1)}</Text>
                </View>
                <View style={[styles.tableCol, { width: '10%' }]}>
                  <Text style={styles.tableCell}>${item.rate.toFixed(2)}</Text>
                </View>
                <View style={[styles.tableCol, { width: '10%' }]}>
                  <Text style={styles.tableCell}>${item.amount.toFixed(2)}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Summary and Footer - only on last page */}
          {page.isLastPage && (
            <View style={styles.footer}>
              <View style={styles.summarySection}>
                <View style={styles.summaryTable}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Positions:</Text>
                    <Text style={styles.summaryValue}>{data.lineItems.length}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Total Hours:</Text>
                    <Text style={styles.summaryValue}>{data.summary.totalHours.toFixed(1)}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Subtotal:</Text>
                    <Text style={styles.summaryValue}>${data.summary.subtotal.toFixed(2)}</Text>
                  </View>
                  {data.summary.totalHST > 0 && (
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>
                        HST @ {data.summary.hstPercentage?.toFixed(2) || '0.00'}%:
                      </Text>
                      <Text style={styles.summaryValue}>${data.summary.totalHST.toFixed(2)}</Text>
                    </View>
                  )}
                  {data.summary.totalGST > 0 && (
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>
                        GST @ {data.summary.gstPercentage?.toFixed(2) || '0.00'}%:
                      </Text>
                      <Text style={styles.summaryValue}>${data.summary.totalGST.toFixed(2)}</Text>
                    </View>
                  )}
                  {data.summary.totalQST > 0 && (
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>
                        QST @ {data.summary.qstPercentage?.toFixed(2) || '0.00'}%:
                      </Text>
                      <Text style={styles.summaryValue}>${data.summary.totalQST.toFixed(2)}</Text>
                    </View>
                  )}
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Total Tax:</Text>
                    <Text style={styles.summaryValue}>${data.summary.totalTax.toFixed(2)}</Text>
                  </View>
                  <View style={[styles.summaryRow, styles.totalRow]}>
                    <Text style={[styles.summaryLabel, { color: 'white' }]}>Grand Total:</Text>
                    <Text style={[styles.summaryValue, { color: 'white' }]}>${data.summary.grandTotal.toFixed(2)}</Text>
                  </View>
                </View>
              </View>

              {/* Footer Messages */}
              {data.messageOnInvoice && (
                <Text style={styles.footerMessage}>
                  <Text style={{ fontWeight: 'bold' }}>Message: </Text>
                  {data.messageOnInvoice}
                </Text>
              )}
              {data.termsOnInvoice && (
                <Text style={styles.footerTerms}>
                  <Text style={{ fontWeight: 'bold' }}>Terms: </Text>
                  {data.termsOnInvoice}
                </Text>
              )}
            </View>
          )}

          {/* Page Number - on every page */}
          <View style={styles.pageNumber}>
            <Text style={styles.pageNumberText}>
              Page {pageIndex + 1} of {totalPages}
            </Text>
          </View>
        </Page>
      ))}
    </Document>
  );
};

// Main function to generate PDF
export const generateInvoicePDF = async (data: InvoiceData): Promise<Blob> => {
  try {
    const doc = <InvoicePDFDocument data={data} />;
    const pdfBlob = await pdf(doc).toBlob();
    return pdfBlob;
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Failed to generate PDF');
  }
};

// Export for compatibility
export default generateInvoicePDF; 