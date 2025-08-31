import { useNavigate } from 'react-router-dom';
import { AppHeader } from '../../components/AppHeader';
import { useLanguage } from '../../contexts/language/language-provider';
import { FileText, BarChart3, Clock, Receipt, Users, FileMinus } from 'lucide-react';
import '../../styles/pages/ClientManagement.css';
import '../../styles/components/header.css';
import '../../styles/pages/Reports.css';

const getReportCategories = (t: (key: string) => string) => [
  {
    title: t('reports.categories.timesheetsPayroll'),
    reports: [
      {
        id: 'weekly-timesheet',
        icon: <Clock size={20} color="#FF9800" />,
        title: t('reports.types.weeklyTimesheet.title'),
        description: t('reports.types.weeklyTimesheet.description'),
        to: '/reports/weekly-timesheet',
      },
      {
        id: 'deduction-report',
        icon: <FileMinus size={20} color="#E91E63" />,
        title: t('reports.types.deductionReport.title'),
        description: t('reports.types.deductionReport.description'),
        to: '/reports/deduction',
      },
    ],
  },
  {
    title: t('reports.categories.salesInvoices'),
    reports: [
      {
        id: 'invoice-report',
        icon: <Receipt size={20} color="#3F51B5" />,
        title: t('reports.types.invoiceReport.title'),
        description: t('reports.types.invoiceReport.description'),
        to: '/reports/invoice',
      },
      {
        id: 'sales-report',
        icon: <BarChart3 size={20} color="#009688" />,
        title: t('reports.types.salesReport.title'),
        description: t('reports.types.salesReport.description'),
        to: '/reports/sales',
      },
      {
        id: 'rate-list',
        icon: <FileText size={20} color="#4CAF50" />,
        title: t('reports.types.rateList.title'),
        description: t('reports.types.rateList.description'),
        to: '/reports/rate-list',
      },
      {
        id: 'margin-report',
        icon: <BarChart3 size={20} color="#FF5722" />,
        title: t('reports.types.marginReport.title'),
        description: t('reports.types.marginReport.description'),
        to: '/reports/margin',
      },
    ],
  },
  {
    title: t('reports.categories.printingClients'),
    reports: [
      {
        id: 'envelope-printing-position',
        icon: <FileText size={20} color="#9C27B0" />,
        title: t('reports.types.envelopePrinting.title'),
        description: t('reports.types.envelopePrinting.description'),
        to: '/reports/envelope-printing-position',
      },
      {
        id: 'clients',
        icon: <Users size={20} color="#607D8B" />,
        title: t('reports.types.clients.title'),
        description: t('reports.types.clients.description'),
        to: '/reports/clients',
      },
    ],
  },
];

export function Reports() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const reportCategories = getReportCategories(t);

  return (
    <div className="page-container">
      <AppHeader title={t('reports.title')} />
      <div className="reports-container">
        <div className="dashboard-heading">
          <h1 className="dashboard-title">{t('navigation.reportsAnalytics')}</h1>
          <div className="user-role-badge">
            <FileText className="role-icon" />
            <span>{t('reports.portal')}</span>
          </div>
        </div>
        <p className="dashboard-subtitle">
          {t('reports.subtitle')}
        </p>
        {reportCategories.map((category) => (
          <div key={category.title} className="report-category-section">
            <h3 className="report-category-title">{category.title}</h3>
            <div className="reports-grid">
              {category.reports.map((report) => (
                <div
                  key={report.id}
                  className="report-card"
                  onClick={() => navigate(report.to)}
                  tabIndex={0}
                  role="button"
                  style={{ cursor: 'pointer' }}
                >
                  <div className="report-icon">{report.icon}</div>
                  <div className="report-card-content">
                    <div className="report-title">{report.title}</div>
                    <div className="report-description">{report.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 