import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { EmployeeDetail, Employee } from '../shared/compensation.ts';
import { MAX_SALARY_MAJOR, parseSalaryMinor } from '../shared/compensation.ts';
import { api, ApiError, messageFor } from './api.ts';
import { ErrorNotice } from './components.tsx';
import { countryName, employeeInitials, money } from './format.ts';

const dateFormat = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' });

export function EmployeePanel({ id, onClose, onSaved }: { id: number; onClose: () => void; onSaved: (name: string) => void }) {
  const trigger = useRef(document.activeElement);
  const [detail, setDetail] = useState<EmployeeDetail>();
  const [loadError, setLoadError] = useState('');
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [saved, setSaved] = useState(false);
  const parsedAmount = parseSalaryMinor(amount);

  async function load(signal?: AbortSignal) {
    setLoadError('');
    try {
      const latest = await api<EmployeeDetail>(`/employees/${id}`, { signal });
      setDetail(latest);
      setConflict(false);
      setEditError('');
    } catch (error) {
      if (!signal?.aborted) setLoadError(messageFor(error));
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [id]);

  function beginEdit() {
    if (!detail) return;
    setAmount((detail.salaryMinor / 100).toFixed(2));
    setReason('');
    setEditError('');
    setConflict(false);
    setSaved(false);
    setEditing(true);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail || saving || conflict) return;
    if (parsedAmount === null) {
      setEditError(`Enter an amount between 0.01 and ${MAX_SALARY_MAJOR.toLocaleString('en')}, with up to two decimal places.`);
      return;
    }
    if (parsedAmount === detail.salaryMinor) {
      setEditError('Enter an amount different from the current salary.');
      return;
    }
    if (reason.trim().length < 5) {
      setEditError('Enter a reason of at least five characters.');
      return;
    }
    setEditError('');
    setSaving(true);
    try {
      const updated = await api<Employee>(`/employees/${id}/salary`, {
        method: 'PATCH', body: JSON.stringify({ salaryMinor: parsedAmount, reason, version: detail.version }),
      });
      setDetail({ ...detail, ...updated });
      setEditing(false);
      setSaved(true);
      onSaved(updated.name);
      await load();
    } catch (error) {
      setEditError(messageFor(error));
      if (error instanceof ApiError && error.status === 409) setConflict(true);
    } finally {
      setSaving(false);
    }
  }

  return <Dialog.Root open onOpenChange={open => { if (!open && !saving) onClose(); }}>
    <Dialog.Portal>
      <Dialog.Overlay className="drawer-overlay" />
      <Dialog.Content className="employee-panel" onCloseAutoFocus={event => {
        event.preventDefault();
        if (trigger.current instanceof HTMLElement) trigger.current.focus();
      }}>
    <header className="drawer-header">
      <div><span className="eyebrow">EMPLOYEE RECORD</span><Dialog.Title>{detail?.name ?? 'Employee details'}</Dialog.Title>
        <Dialog.Description className="sr-only">Review current base pay and salary change history.</Dialog.Description></div>
      <button type="button" className="button icon" aria-label="Close employee details" disabled={saving} onClick={onClose}>×</button>
    </header>
    <div className="drawer-content">
      {loadError && <ErrorNotice onRetry={() => void load()}>{loadError}</ErrorNotice>}
      {!detail && !loadError && <p role="status">Loading employee…</p>}
      {detail && <>
        <div className="employee-summary"><span className="avatar large" aria-hidden="true">{employeeInitials(detail.name)}</span>
          <div><strong>{detail.title}</strong><p>{detail.code} · {detail.department} · {countryName(detail.country)}</p></div></div>
        {saved && <div className="notice success" role="status">Salary saved. {loadError ? 'Reload to view the change history.' : 'The change is recorded in the history.'}</div>}
        <section className="pay-card" aria-labelledby="current-salary">
          <div><span id="current-salary" className="eyebrow">CURRENT ANNUAL BASE SALARY</span>
            <div className="salary-value">{money(detail.salaryMinor, detail.currency)} <small>{detail.currency}</small></div></div>
          {!editing && <button className="button primary" type="button" disabled={saving} onClick={beginEdit}>Update salary</button>}
        </section>
        {editing && <form className="edit-form" onSubmit={save}>
          <h3>Update salary</h3>
          {editError && <ErrorNotice>{editError}</ErrorNotice>}
          {conflict && <button className="button secondary" type="button" onClick={() => void load()}>Reload current salary</button>}
          <label className="control"><span>New annual base salary ({detail.currency})</span>
            <input value={amount} onChange={event => setAmount(event.target.value)} inputMode="decimal" required disabled={saving} /></label>
          {parsedAmount !== null && parsedAmount !== detail.salaryMinor &&
            <p className="comparison">{money(detail.salaryMinor, detail.currency)} → <strong>{money(parsedAmount, detail.currency)}</strong></p>}
          <label className="control"><span>Reason for change</span><textarea placeholder="e.g. Annual compensation review"
            value={reason} onChange={event => setReason(event.target.value)} required maxLength={500} rows={3} disabled={saving} /></label>
          <div className="form-actions"><button className="button primary" disabled={saving || conflict}>{saving ? 'Saving…' : 'Save salary change'}</button>
            <button type="button" className="button secondary" disabled={saving} onClick={() => setEditing(false)}>Cancel</button></div>
        </form>}
        <section className="history" aria-labelledby="history-title"><h3 id="history-title">Salary history</h3>
          {detail.history.length === 0 ? <p className="muted">No changes recorded for this employee yet.</p> :
            <ol>{detail.history.map(change => <li key={change.id}>
              <strong>{money(change.oldSalaryMinor, change.currency)} → {money(change.newSalaryMinor, change.currency)}</strong>
              <p>{change.reason}</p><small>{dateFormat.format(new Date(change.changedAt))} · {change.actor}</small>
            </li>)}</ol>}
        </section>
      </>}
    </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
