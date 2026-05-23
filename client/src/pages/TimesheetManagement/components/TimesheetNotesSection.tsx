import { useTimesheetFormTranslation } from "../hooks/useTimesheetFormTranslation";

interface TimesheetNotesSectionProps {
  notes: string;
  onChange: (value: string) => void;
}

export function TimesheetNotesSection({
  notes,
  onChange,
}: TimesheetNotesSectionProps) {
  const tf = useTimesheetFormTranslation();

  return (
    <div className="timesheet-notes-section">
      <h4 className="timesheet-notes-title">{tf("additionalNotes")}</h4>
      <textarea
        value={notes}
        onChange={(e) => onChange(e.target.value)}
        placeholder={tf("notesPlaceholder")}
        className="timesheet-notes-textarea"
        rows={4}
      />
    </div>
  );
}
