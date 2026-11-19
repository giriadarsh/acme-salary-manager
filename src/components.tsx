import { useId } from 'react';
import type { FilterOptions, Filters } from '../shared/compensation.ts';
import { countryName } from './format.ts';

export const defaultFilters: Filters = { country: '', department: '' };

export function queryFor(filters: Filters, additional: Record<string, string> = {}) {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries({ ...filters, ...additional })) {
    if (value) params.set(name, value);
  }
  return params.toString();
}

export function Brand() {
  return <div className="brand"><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
    <span><strong>ACME</strong><small>Salary Manager</small></span></div>;
}

export function FilterSelectors({ filters, options, onChange }: {
  filters: Filters; options: FilterOptions; onChange: (filters: Filters) => void;
}) {
  const prefix = useId();
  return <>
    <div className="control"><label htmlFor={`${prefix}-country`}>Country</label>
      <select id={`${prefix}-country`} value={filters.country} onChange={event => onChange({ ...filters, country: event.target.value })}>
        <option value="">All countries</option>
        {options.countries.map(country => <option key={country} value={country}>{countryName(country)}</option>)}
      </select>
    </div>
    <div className="control"><label htmlFor={`${prefix}-department`}>Department</label>
      <select id={`${prefix}-department`} value={filters.department} onChange={event => onChange({ ...filters, department: event.target.value })}>
        <option value="">All departments</option>
        {options.departments.map(department => <option key={department}>{department}</option>)}
      </select>
    </div>
  </>;
}

export function ErrorNotice({ children, onRetry }: { children: string; onRetry?: () => void }) {
  return <div className="notice error" role="alert">{children}
    {onRetry && <button className="button secondary small" type="button" onClick={onRetry}>Try again</button>}
  </div>;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="empty"><strong>{title}</strong><p>{description}</p></div>;
}
