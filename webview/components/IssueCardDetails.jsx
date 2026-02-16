import MarkdownRenderer from './MarkdownRenderer';

const IssueCardDetails = ({ 
  isLoadingDetails, 
  detailedData, 
  issue, 
  totalRelationships,
  loadingDeps,
  dependencies,
  dependents,
  loadingComments,
  comments
}) => {
  if (isLoadingDetails) {
    return <div className="issue-card__loading">⏳ Loading details...</div>;
  }

  return (
    <>
      {(detailedData?.description || issue.description) && (
        <div className="issue-card__description">
          <strong>Description:</strong>
          <MarkdownRenderer content={detailedData?.description || issue.description} />
        </div>
      )}
      {detailedData?.acceptance && (
        <div className="issue-card__acceptance">
          <strong>Acceptance Criteria:</strong>
          <MarkdownRenderer content={detailedData.acceptance} />
        </div>
      )}
      {detailedData?.design && (
        <div className="issue-card__design">
          <strong>Design Notes:</strong>
          <MarkdownRenderer content={detailedData.design} />
        </div>
      )}
      {detailedData?.notes && (
        <div className="issue-card__notes">
          <strong>Notes:</strong>
          <MarkdownRenderer content={detailedData.notes} />
        </div>
      )}
      {/* Relationships section */}
      {totalRelationships > 0 && (
        <div className="issue-card__relationships">
          <strong>Relationships:</strong>
          {loadingDeps && (
            <div className="issue-card__loading">⏳ Loading relationships...</div>
          )}
          {!loadingDeps && dependencies !== null && (
            <div className="issue-card__relationships-content">
              {dependencies.length > 0 && (
                <div className="issue-card__relationship-group">
                  <span className="issue-card__relationship-label">Depends on ({dependencies.length}):</span>
                  <div className="issue-card__relationship-list">
                    {dependencies.map((dep, idx) => (
                      <span key={idx} className="issue-card__relationship-item issue-card__relationship-item--dependency">
                        {dep.to_id || dep.ToID || dep.target_id || dep.id || JSON.stringify(dep)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {dependents && dependents.length > 0 && (
                <div className="issue-card__relationship-group">
                  <span className="issue-card__relationship-label">Depended on by ({dependents.length}):</span>
                  <div className="issue-card__relationship-list">
                    {dependents.map((dep, idx) => (
                      <span key={idx} className="issue-card__relationship-item issue-card__relationship-item--dependent">
                        {dep.from_id || dep.FromID || dep.source_id || dep.id || JSON.stringify(dep)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {dependencies.length === 0 && (!dependents || dependents.length === 0) && (
                <div className="issue-card__relationship-empty">No detailed relationship info available</div>
              )}
            </div>
          )}
        </div>
      )}
      {loadingComments && (
        <div className="issue-card__loading">⏳ Loading comments...</div>
      )}
      {!loadingComments && comments.length > 0 && (
        <div className="issue-card__comments">
          <strong>Comments ({comments.length}):</strong>
          {comments.map((comment, idx) => (
            <div key={idx} className="issue-card__comment">
              <div className="issue-card__comment-header">
                <span className="issue-card__comment-author">{comment.author}</span>
                <span className="issue-card__comment-time">{comment.timestamp}</span>
              </div>
              <div className="issue-card__comment-text">{comment.text}</div>
            </div>
          ))}
        </div>
      )}
      <div className="issue-card__metadata">
        <div><strong>Created:</strong> {issue.created_at ? new Date(issue.created_at).toLocaleString() : 'N/A'}</div>
        {issue.updated_at && <div><strong>Updated:</strong> {new Date(issue.updated_at).toLocaleString()}</div>}
        {issue.closed_at && <div><strong>Closed:</strong> {new Date(issue.closed_at).toLocaleString()}</div>}
      </div>
    </>
  );
};

export default IssueCardDetails;