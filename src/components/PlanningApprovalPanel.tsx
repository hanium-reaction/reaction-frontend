import type { AiDraftCardProps } from './AiDraftCard';
import '../styles/planning-flow-redesign.css';

/** Planning-only approval surface. The parent owns validation and all mutations. */
export function PlanningApprovalPanel({ children, headerAction, aiSource, onAccept, onEdit, onReject, acceptDisabled = false, acceptLabel = '수락', editLabel = '수정', rejectLabel = '재생성' }: AiDraftCardProps) {
  return <section className="plan-flow-approval" aria-label="초안 검토 및 승인">
    <div className="plan-flow-approval-heading">
      <span className="plan-flow-draft-badge">{aiSource === 'llm' ? 'AI 초안' : '규칙 기반 초안'}</span>
      <span className="plan-flow-approval-hint">확인 후 다음 단계로</span>
      {headerAction}
    </div>
    <div className="plan-flow-approval-summary">{children}{aiSource === 'rule' && <p className="plan-flow-rule-note">오프라인 모드(룰 기반)로 자동 분배됨. AI 호출 가능 시 다시 생성해보세요.</p>}</div>
    <div className="plan-flow-approval-actions">
      <button type="button" className="plan-flow-secondary" onClick={onEdit}>{editLabel}</button>
      <button type="button" className="plan-flow-secondary" onClick={onReject}>{rejectLabel}</button>
      <button type="button" className="plan-flow-primary" disabled={acceptDisabled} onClick={onAccept}>{acceptLabel}</button>
    </div>
  </section>;
}
