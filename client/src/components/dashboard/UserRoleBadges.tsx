import { UserCheck, ShieldCheck, User, Calculator, Building, TrendingUp, Users, Crown } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/language/language-provider";
import { getResolvedUserRoles, type AccessRole } from "../../lib/auth";

interface UserRoleBadgesProps {
  className?: string;
}

export function UserRoleBadges({ className = "" }: UserRoleBadgesProps) {
  const { user } = useAuth();
  const { t } = useLanguage();

  if (!user) return null;

  const resolvedRoles = getResolvedUserRoles(user);
  const displayRoles = resolvedRoles.length > 0 ? resolvedRoles : [(user.user_metadata?.user_type as AccessRole) || "jobseeker"];

  const getRoleLabel = (role: AccessRole) => {
    switch (role) {
      case "admin":
        return t("roles.admin") || "Admin";
      case "recruiter_director":
        return t("roles.recruiter_director") || "Recruiter Director";
      case "recruiter_manager":
        return t("roles.recruiter_manager") || "Recruiter Manager";
      case "accountant_manager":
        return t("roles.accountant_manager") || "Accountant Manager";
      case "bookkeeper":
        return t("roles.bookkeeper") || "Bookkeeper";
      case "sales":
        return t("roles.sales") || "Sales";
      case "recruiter":
        return t("roles.recruiter") || "Recruiter";
      case "jobseeker":
        return t("roles.jobseeker") || "Job Seeker";
      default:
        return role;
    }
  };

  const getRoleIcon = (role: AccessRole | string) => {
    switch (role) {
      case "admin":
        return <ShieldCheck className={`role-icon ${role}`} />;
      case "recruiter_director":
        return <Crown className={`role-icon ${role}`} />;
      case "recruiter_manager":
        return <Users className={`role-icon ${role}`} />;
      case "accountant_manager":
        return <Building className={`role-icon ${role}`} />;
      case "bookkeeper":
        return <Calculator className={`role-icon ${role}`} />;
      case "sales":
        return <TrendingUp className={`role-icon ${role}`} />;
      case "recruiter":
        return <UserCheck className={`role-icon ${role}`} />;
      case "jobseeker":
        return <User className={`role-icon ${role}`} />;
      default:
        return <UserCheck className={`role-icon ${role}`} />;
    }
  };

  return (
    <div className={`user-role-badges-group ${className}`}>
      {displayRoles.map((role) => (
        <div key={role} className={`user-role-badge badge-role-${role}`}>
          {getRoleIcon(role)}
          <span>{getRoleLabel(role)}</span>
        </div>
      ))}
    </div>
  );
}
