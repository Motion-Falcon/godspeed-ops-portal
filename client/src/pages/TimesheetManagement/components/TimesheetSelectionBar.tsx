import {
  Calendar,
  FileText,
  User,
  Building,
} from "lucide-react";
import {
  CustomDropdown,
  DropdownOption,
} from "../../../components/CustomDropdown";
import type { JobSeekerProfile } from "../../../types/jobseeker";
import type { ClientData } from "../../../services/api/client";
import { DropdownSkeleton } from "./DropdownSkeleton";
import { useTimesheetFormTranslation } from "../hooks/useTimesheetFormTranslation";

export interface TimesheetSelectionBarProps {
  jobseekerLoading: boolean;
  clientLoading: boolean;
  positionLoading: boolean;
  jobseekerOptions: DropdownOption[];
  clientOptions: DropdownOption[];
  positionOptions: DropdownOption[];
  weekDropdownOptions: DropdownOption[];
  selectedJobseekerOption: DropdownOption | null | undefined;
  selectedClientOption: DropdownOption | null | undefined;
  selectedPositionOption: DropdownOption | null | undefined;
  selectedWeekOption: DropdownOption | null | undefined;
  selectedJobseeker: JobSeekerProfile | null;
  selectedClient: ClientData | null;
  onJobseekerSelect: (option: DropdownOption | DropdownOption[]) => void;
  onClientSelect: (option: DropdownOption | DropdownOption[]) => void;
  onPositionSelect: (option: DropdownOption | DropdownOption[]) => void;
  onWeekSelect: (option: DropdownOption | DropdownOption[]) => void;
}

export function TimesheetSelectionBar({
  jobseekerLoading,
  clientLoading,
  positionLoading,
  jobseekerOptions,
  clientOptions,
  positionOptions,
  weekDropdownOptions,
  selectedJobseekerOption,
  selectedClientOption,
  selectedPositionOption,
  selectedWeekOption,
  selectedJobseeker,
  selectedClient,
  onJobseekerSelect,
  onClientSelect,
  onPositionSelect,
  onWeekSelect,
}: TimesheetSelectionBarProps) {
  const tf = useTimesheetFormTranslation();

  return (
    <div className="timesheet-selection-bar">
      <div className="selection-section">
        <label className="selection-label">
          <User size={16} />
          {tf("selection.jobSeeker")}
        </label>
        {jobseekerLoading ? (
          <DropdownSkeleton />
        ) : (
          <CustomDropdown
            options={jobseekerOptions}
            selectedOption={selectedJobseekerOption}
            onSelect={onJobseekerSelect}
            placeholder={tf("selection.searchJobseeker")}
            loading={false}
            icon={<User size={16} />}
            emptyMessage={tf("selection.noJobseekers")}
          />
        )}
      </div>

      <div className="selection-section">
        <label className="selection-label">
          <Building size={16} />
          {tf("selection.client")}
        </label>
        {clientLoading ? (
          <DropdownSkeleton />
        ) : (
          <CustomDropdown
            options={clientOptions}
            selectedOption={selectedClientOption}
            onSelect={onClientSelect}
            placeholder={
              selectedJobseeker
                ? tf("selection.searchClient")
                : tf("selection.selectJobseekerFirst")
            }
            disabled={!selectedJobseeker}
            loading={false}
            icon={<Building size={16} />}
            emptyMessage={
              selectedJobseeker
                ? tf("selection.noClients")
                : tf("selection.selectJobseekerForClients")
            }
          />
        )}
      </div>

      <div className="selection-section">
        <label className="selection-label">
          <FileText size={16} />
          {tf("selection.position")}
        </label>
        {positionLoading ? (
          <DropdownSkeleton />
        ) : (
          <CustomDropdown
            options={positionOptions}
            selectedOption={selectedPositionOption}
            onSelect={onPositionSelect}
            placeholder={
              selectedClient
                ? tf("selection.searchPosition")
                : selectedJobseeker
                  ? tf("selection.selectClientFirst")
                  : tf("selection.selectJobseekerAndClient")
            }
            disabled={!selectedClient}
            loading={false}
            icon={<FileText size={16} />}
            emptyMessage={
              selectedClient
                ? tf("selection.noPositions")
                : !selectedJobseeker
                  ? tf("selection.selectJobseekerAndClientForPositions")
                  : tf("selection.selectClientForPositions")
            }
          />
        )}
      </div>

      <div className="selection-section">
        <label className="selection-label">
          <Calendar size={16} />
          {tf("selection.weekPeriod")}
        </label>
        <CustomDropdown
          options={weekDropdownOptions}
          selectedOption={selectedWeekOption}
          onSelect={onWeekSelect}
          placeholder={tf("selection.selectWeek")}
          loading={false}
          icon={<Calendar size={16} />}
          emptyMessage={tf("selection.noWeekOptions")}
          searchable={false}
        />
      </div>
    </div>
  );
}
