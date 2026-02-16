const CreatePanel= ({ 
  title, 
  type, 
  priority, 
  description,
  parentId,
  blocksId,
  relatedId,
  currentFile,
  onTitleChange,
  onTypeChange,
  onPriorityChange,
  onDescriptionChange,
  onParentIdChange,
  onBlocksIdChange,
  onRelatedIdChange,
  onCreate,
  onCancel,
  onAISuggest,
  isAILoading
}) => {
  return (
    <div className="section">
      <div className="section-title">Create New Issue</div>
      <div className="relationship-content">
        <div className="relationship-group">
          <label className="relationship-label">Title *</label>
          <div className="title-input-row">
            <input
              type="text"
              className="relationship-input title-input"
              placeholder="Brief description of the issue"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
            />
            <button 
              className="ai-suggest-btn" 
              onClick={onAISuggest}
              disabled={!title.trim() || isAILoading}
              title="Use AI to suggest type, priority, and related issues"
            >
              {isAILoading ? '⏳' : '✨'}
            </button>
          </div>
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
          <label className="relationship-label">Description (optional)</label>
          <textarea
            className="relationship-input"
            rows="3"
            placeholder="Additional details about the issue"
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
          />
        </div>

        <div className="relationship-group">
          <label className="relationship-label">Related Issues (optional)</label>
          <div className="relationship-grid">
            <input
              type="text"
              className="relationship-input relationship-input-compact"
              placeholder="Parent (e.g., beads_ui-5)"
              value={parentId}
              onChange={(e) => onParentIdChange(e.target.value)}
              title="This issue will be a child of the parent"
            />
            <input
              type="text"
              className="relationship-input relationship-input-compact"
              placeholder="Blocks (e.g., beads_ui-10)"
              value={blocksId}
              onChange={(e) => onBlocksIdChange(e.target.value)}
              title="This issue must be completed before the blocked issue"
            />
            <input
              type="text"
              className="relationship-input relationship-input-compact"
              placeholder="Related (e.g., beads_ui-15)"
              value={relatedId}
              onChange={(e) => onRelatedIdChange(e.target.value)}
              title="This issue is related to another issue"
            />
          </div>
        </div>

        {currentFile && (
          <div className="relationship-group">
            <label className="relationship-label">📎 Current File Reference</label>
            <div className="file-reference">
              {currentFile}
            </div>
            <div className="relationship-info">
              <small>Will be added to issue notes</small>
            </div>
          </div>
        )}

        <div className="relationship-actions">
          <button className="action-btn" onClick={onCreate}>
            ➕ Create Issue
          </button>
          <button className="clear-btn" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreatePanel;
