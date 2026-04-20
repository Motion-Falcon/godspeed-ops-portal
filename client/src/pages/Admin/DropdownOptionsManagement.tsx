import { useState, useEffect, useCallback } from "react";
import { AppHeader } from "../../components/AppHeader";
import { useLanguage } from "../../contexts/language/language-provider";
import {
  getDropdownOptions,
  createDropdownOption,
  updateDropdownOption,
  deleteDropdownOption,
  LIST_TYPE_LABELS,
  type ClientDropdownOption,
  type DropdownListType,
} from "../../services/api/dropdownOptions";
import { Plus, Trash2, Edit2, Check, X, ClipboardList } from "lucide-react";
import "../../styles/components/form.css";
import "../../styles/components/button.css";
import "../../styles/pages/RecruiterHierarchy.css";
import "../../styles/pages/ClientManagement.css";
import "./DropdownOptionsManagement.css";

const CLIENT_LIST_TYPES: DropdownListType[] = [
  "client_manager",
  "client_representative",
  "salesperson",
  "accounting_person",
  "accounting_manager",
  "list_name",
];

const POSITION_LIST_TYPES: DropdownListType[] = [
  "position_title",
  "subcategory_portion",
];

export function DropdownOptionsManagement() {
  const { t } = useLanguage();
  const [selectedListType, setSelectedListType] =
    useState<DropdownListType>("client_manager");
  const [options, setOptions] = useState<ClientDropdownOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Add form state
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);

  const loadOptions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const all = await getDropdownOptions();
      const filtered = all.filter((o) => o.listType === selectedListType);
      setOptions(filtered);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load options");
    } finally {
      setLoading(false);
    }
  }, [selectedListType]);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;

    setAdding(true);
    setAddError(null);
    try {
      await createDropdownOption(selectedListType, name);
      setNewName("");
      setSuccess(t("dropdownOptions.added"));
      setTimeout(() => setSuccess(null), 3000);
      loadOptions();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to add");
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (opt: ClientDropdownOption) => {
    setEditingId(opt.id);
    setEditValue(opt.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const trimmed = editValue.trim();
    if (!trimmed) return;

    setSaving(true);
    try {
      await updateDropdownOption(editingId, { name: trimmed });
      setSuccess(t("dropdownOptions.updated"));
      setTimeout(() => setSuccess(null), 3000);
      setEditingId(null);
      setEditValue("");
      loadOptions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (opt: ClientDropdownOption) => {
    if (!window.confirm(t("dropdownOptions.confirmDelete", { name: opt.name }) || `Delete "${opt.name}"?`))
      return;

    try {
      await deleteDropdownOption(opt.id);
      setSuccess(t("dropdownOptions.deleted"));
      setTimeout(() => setSuccess(null), 3000);
      loadOptions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  const currentLabel =
    LIST_TYPE_LABELS[selectedListType] || selectedListType;

  return (
    <div className="page-container recruiter-hierarchy dropdown-options-management">
      <AppHeader
        title={t("dropdownOptions.title")}
        statusMessage={error || success}
        statusType={error ? "error" : "success"}
      />

      <div className="content-container">
        <div className="dashboard-heading">
          <h1 className="dashboard-title">{t("dropdownOptions.title")}</h1>
          <div className="user-role-badge">
            <ClipboardList className="role-icon" size={18} />
            <span>{t("dropdownOptions.title")}</span>
          </div>
        </div>
        <p className="dashboard-subtitle">{t("dropdownOptions.subtitle")}</p>

        <div className="card dopts-card">
          <div className="dopts-tabs" role="tablist">
            <div className="dopts-tab-group">
              <span className="dopts-tab-group-label">{t("dropdownOptions.clientOptions")}</span>
              <div className="dopts-tab-group-buttons">
                {CLIENT_LIST_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={`dopts-tab-btn ${selectedListType === type ? "dopts-tab-btn--active" : ""}`}
                    onClick={() => setSelectedListType(type)}
                  >
                    {LIST_TYPE_LABELS[type]}
                  </button>
                ))}
              </div>
            </div>
            <div className="dopts-tab-group">
              <span className="dopts-tab-group-label">{t("dropdownOptions.positionOptions")}</span>
              <div className="dopts-tab-group-buttons">
                {POSITION_LIST_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={`dopts-tab-btn ${selectedListType === type ? "dopts-tab-btn--active" : ""}`}
                    onClick={() => setSelectedListType(type)}
                  >
                    {LIST_TYPE_LABELS[type]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="card-body dopts-card-body">
            <div className="dopts-add-section">
              <h3 className="dopts-section-title">{t("dropdownOptions.addNew", { list: currentLabel }) || `Add new ${currentLabel}`}</h3>
              <form onSubmit={handleAdd} className="dopts-add-form">
                <div className="form-group dopts-form-group">
                  <input
                    type="text"
                    id="dopts-new-name"
                    className="form-input"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder={t("dropdownOptions.namePlaceholder")}
                    disabled={adding}
                  />
                </div>
                <button
                  type="submit"
                  className="button primary dopts-btn-add"
                  disabled={adding || !newName.trim()}
                >
                  {adding ? (
                    <span className="loading-spinner" />
                  ) : (
                    <>
                      <Plus size={16} />
                      {t("dropdownOptions.addButton")}
                    </>
                  )}
                </button>
              </form>
              {addError && (
                <p className="form-error dopts-add-error">{addError}</p>
              )}
            </div>

            <div className="dopts-list-section">
              <h3 className="dopts-section-title">{t("dropdownOptions.currentList", { list: currentLabel }) || `Current ${currentLabel} list`}</h3>
              {loading ? (
                <div className="dopts-loading">
                  <span className="loading-spinner" />
                  {t("messages.loading")}
                </div>
              ) : options.length === 0 ? (
                <p className="dopts-empty">{t("dropdownOptions.empty")}</p>
              ) : (
                <ul className="dopts-list">
                  {options.map((opt) => (
                    <li key={opt.id} className="dopts-list-item">
                      {editingId === opt.id ? (
                        <div className="dopts-list-edit">
                          <input
                            type="text"
                            className="form-input dopts-edit-input"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEdit();
                              if (e.key === "Escape") cancelEdit();
                            }}
                            autoFocus
                          />
                          <button
                            type="button"
                            className="button primary dopts-btn-icon"
                            onClick={saveEdit}
                            disabled={saving}
                            title={t("buttons.save")}
                          >
                            <Check size={16} />
                          </button>
                          <button
                            type="button"
                            className="button secondary dopts-btn-icon"
                            onClick={cancelEdit}
                            disabled={saving}
                            title={t("buttons.cancel")}
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="dopts-list-name">{opt.name}</span>
                          <div className="dopts-list-actions">
                            <button
                              type="button"
                              className="button secondary dopts-btn-icon"
                              onClick={() => startEdit(opt)}
                              title={t("buttons.edit")}
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              type="button"
                              className="button secondary dopts-btn-icon dopts-btn-icon--danger"
                              onClick={() => handleDelete(opt)}
                              title={t("buttons.delete")}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
