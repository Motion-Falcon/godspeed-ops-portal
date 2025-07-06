import { useNavigate } from 'react-router-dom';
import { AppHeader } from '../../components/AppHeader';
import { FileText, BarChart3, Clock, Receipt, Users, FileMinus } from 'lucide-react';
import '../../styles/pages/ClientManagement.css';
import '../../styles/components/header.css';
import '../../styles/pages/Reports.css';

const REPORT_CATEGORIES = [
  {
    title: 'Timesheets & Payroll',
    reports: [
      {
        id: 'weekly-timesheet',
        icon: <Clock size={20} color="#FF9800" />,
        title: 'Weekly Timesheet',
        description: 'View and export weekly timesheet summaries for all users.',
        to: '/reports/weekly-timesheet',
      },
      {
        id: 'deduction-report',
        icon: <FileMinus size={20} color="#E91E63" />,
        title: 'Deduction Report',
        description: 'Review and export deduction details for payroll and compliance.',
        to: '/reports/deduction',
      },
    ],
  },
  {
    title: 'Sales & Invoices',
    reports: [
      {
        id: 'invoice-report',
        icon: <Receipt size={20} color="#3F51B5" />,
        title: 'Invoice Report',
        description: 'Generate and review invoice reports for clients and jobseekers.',
        to: '/reports/invoice',
      },
      {
        id: 'sales-report',
        icon: <BarChart3 size={20} color="#009688" />,
        title: 'Sales Report',
        description: 'Analyze sales data and trends across your organization.',
        to: '/reports/sales',
      },
      {
        id: 'rate-list',
        icon: <FileText size={20} color="#4CAF50" />,
        title: 'Rate List',
        description: 'View and export the current rate list for all services and positions.',
        to: '/reports/rate-list',
      },
      {
        id: 'margin-report',
        icon: <BarChart3 size={20} color="#FF5722" />,
        title: 'Margin Report',
        description: 'Review margin analysis and profitability across clients and services.',
        to: '/reports/margin',
      },
    ],
  },
  {
    title: 'Printing & Clients',
    reports: [
      {
        id: 'envelope-printing-position',
        icon: <FileText size={20} color="#9C27B0" />,
        title: 'Envelope Printing (Position Details)',
        description: 'Print envelopes with detailed position information for selected users.',
        to: '/reports/envelope-printing-position',
      },
      {
        id: 'envelope-printing',
        icon: <FileText size={20} color="#00BCD4" />,
        title: 'Envelope Printing Report',
        description: 'Print envelopes for selected users or clients.',
        to: '/reports/envelope-printing',
      },
      {
        id: 'clients',
        icon: <Users size={20} color="#607D8B" />,
        title: 'Clients',
        description: 'View and export client lists and details.',
        to: '/reports/clients',
      },
    ],
  },
];

export function Reports() {
  const navigate = useNavigate();

  return (
    <div className="page-container">
      <AppHeader title="Reports" />
      <div className="reports-container">
        <div className="dashboard-heading">
          <h1 className="dashboard-title">Reports & Analytics</h1>
          <div className="user-role-badge">
            <FileText className="role-icon" />
            <span>Reports Portal</span>
          </div>
        </div>
        <p className="dashboard-subtitle">
          Access and generate various reports to gain insights into your organization. Select a report type below to get started.
        </p>
        {REPORT_CATEGORIES.map((category) => (
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