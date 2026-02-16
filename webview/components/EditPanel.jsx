const EditPanel= ({ 
  issueId,
  title, 
  type, 
  priority, 
  description,
  status,
  onTitleChange,
  onTypeChange,
  onPriorityChange,
  onDescriptionChange,
  onStatusChange,
  onUpdate,
  onCancel
}) => {
  return (
    <div className="section">
      <div className="section-title">Edit Issue {issueId}</div>
      <div className="relationship-content">
        <div className="relationship-group">
          <label className="relationship-label">Title</label>
          <input
            type="text"
            className="relationship-input"
            placeholder="Brief description of the issue"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
          />
        </div>

        <div className="relationship-group">
          <label className="relationship-label">Status</label>
          <select
            className="relationship-select"
            value={status}
            onChange={(e) => onStatusChange(e.target.value)}
          >
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        <div className="relationship-group">
          <label className="relationship-label">Type</label>
          <select
            className="relationship-select"
            value={type}
            onChange={(e) => onTypeChange(e.target.value)}
          >
            <option value="task">Task</option>
            <option value="bug">Bug</option>
            <option value="feature">Feature</option>
            <option value="epic">Epic</option>
            <option value="chore">Chore</option>
          </select>
        </div>

        <div className="relationship-group">
          <label className="relationship-label">Priority</label>
          <select
            className="relationship-select"
            value={priority}
            onChange={(e) => onPriorityChange(e.target.value)}
          >
            <option value="0">P0 - Critical</option>
            <option value="1">P1 - High</option>
            <option value="2">P2 - Medium</option>
            <option value="3">P3 - Low</option>
            <option value="4">P4 - Backlog</option>
          </select>
        </div>

        <div className="relationship-group">
          <label className="relationship-label">Description</label>
          <textarea
            className="relationship-input"
            rows="3"
            placeholder="Additional details about the issue"
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
          />
        </div>

        <div className="relationship-actions">
          <button className="action-btn" onClick={onUpdate}>
            💾 Update Issue
          </button>
          <button className="clear-btn" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditPanel;
