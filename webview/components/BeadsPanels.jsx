import React from 'react';
import CreatePanel from './CreatePanel';
import RelationshipPanel from './RelationshipPanel';
import EditPanel from './EditPanel';
import IntegrationSettingsPanel from './IntegrationSettingsPanel';

const BeadsPanels = ({
  panels,
  createForm,
  relationshipForm,
  editForm,
  currentFile,
  isAILoading,
  onCreateIssue,
  onAISuggest,
  onDepAction,
  onUpdateIssue,
  integrationSettings,
  adoTokenInput,
  onTokenInputChange,
  onSaveIntegration,
  onImportAdo,
  onExportAdo,
  onBackendChange,
  onProjectUrlChange,
  onAreaPathChange,
  onIterationPathChange,
  onImportLimitChange
}) => (
  <>
    {panels.showCreatePanel && (
      <CreatePanel
        title={createForm.createTitle}
        type={createForm.createType}
        priority={createForm.createPriority}
        description={createForm.createDescription}
        parentId={createForm.createParentId}
        blocksId={createForm.createBlocksId}
        relatedId={createForm.createRelatedId}
        currentFile={currentFile}
        onTitleChange={createForm.setCreateTitle}
        onTypeChange={createForm.setCreateType}
        onPriorityChange={createForm.setCreatePriority}
        onDescriptionChange={createForm.setCreateDescription}
        onParentIdChange={createForm.setCreateParentId}
        onBlocksIdChange={createForm.setCreateBlocksId}
        onRelatedIdChange={createForm.setCreateRelatedId}
        onCreate={onCreateIssue}
        onCancel={() => panels.setShowCreatePanel(false)}
        onAISuggest={onAISuggest}
        isAILoading={isAILoading}
      />
    )}

    {panels.showRelationshipPanel && (
      <RelationshipPanel
        sourceBead={relationshipForm.sourceBead}
        targetBead={relationshipForm.targetBead}
        relationType={relationshipForm.relationType}
        onSourceChange={relationshipForm.setSourceBead}
        onTargetChange={relationshipForm.setTargetBead}
        onTypeChange={relationshipForm.setRelationType}
        onLink={() => onDepAction('add')}
        onUnlink={() => onDepAction('remove')}
        onCancel={() => panels.setShowRelationshipPanel(false)}
      />
    )}

    {panels.showSettingsPanel && (
      <IntegrationSettingsPanel
        backend={integrationSettings.backend}
        projectUrl={integrationSettings.ado.projectUrl}
        areaPath={integrationSettings.ado.areaPath}
        iterationPath={integrationSettings.ado.iterationPath}
        importLimit={integrationSettings.ado.importLimit}
        tokenInput={adoTokenInput}
        tokenSet={integrationSettings.ado.tokenSet}
        onBackendChange={onBackendChange}
        onProjectUrlChange={onProjectUrlChange}
        onAreaPathChange={onAreaPathChange}
        onIterationPathChange={onIterationPathChange}
        onImportLimitChange={onImportLimitChange}
        onTokenInputChange={onTokenInputChange}
        onSave={onSaveIntegration}
        onImport={onImportAdo}
        onExport={onExportAdo}
        onClose={() => panels.setShowSettingsPanel(false)}
      />
    )}

    {panels.showEditPanel && (
      <EditPanel
        issueId={editForm.editIssueId}
        title={editForm.editTitle}
        type={editForm.editType}
        priority={editForm.editPriority}
        description={editForm.editDescription}
        status={editForm.editStatus}
        onTitleChange={editForm.setEditTitle}
        onTypeChange={editForm.setEditType}
        onPriorityChange={editForm.setEditPriority}
        onDescriptionChange={editForm.setEditDescription}
        onStatusChange={editForm.setEditStatus}
        onUpdate={onUpdateIssue}
        onCancel={() => panels.setShowEditPanel(false)}
      />
    )}
  </>
);

export default BeadsPanels;
