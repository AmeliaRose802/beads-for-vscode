const RelationshipPanel= ({
  sourceBead,
  targetBead,
  relationType,
  onSourceChange,
  onTargetChange,
  onTypeChange,
  onLink,
  onUnlink,
  onCancel
}) => {
  return (
    <div className="section">
      <div className="section-title">Manage Relationships</div>
      <div className="relationship-content">
        <div className="relationship-group">
          <label className="relationship-label">Source Bead ID:</label>
          <input
            type="number"
            className="relationship-input"
            placeholder="e.g., 1"
            value={sourceBead}
            onChange={(e) => onSourceChange(e.target.value)}
          />
        </div>

        <div className="relationship-group">
          <label className="relationship-label">Relationship Type:</label>
          <select
            className="relationship-select"
            value={relationType}
            onChange={(e) => onTypeChange(e.target.value)}
          >
            <option value="parent">Parent of</option>
            <option value="child">Child of</option>
            <option value="blocks">Blocks</option>
            <option value="blocked-by">Blocked by</option>
            <option value="relates-to">Related to</option>
            <option value="duplicates">Duplicates</option>
            <option value="duplicated-by">Duplicated by</option>
          </select>
        </div>

        <div className="relationship-group">
          <label className="relationship-label">Target Bead ID:</label>
          <input
            type="number"
            className="relationship-input"
            placeholder="e.g., 2"
            value={targetBead}
            onChange={(e) => onTargetChange(e.target.value)}
          />
        </div>

        <div className="relationship-actions">
          <button className="action-btn" onClick={onLink}>
            🔗 Create Link
          </button>
          <button className="action-btn" onClick={onUnlink}>
            ✂️ Remove Link
          </button>
          <button className="clear-btn" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default RelationshipPanel;
