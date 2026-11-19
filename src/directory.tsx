import { useEffect, useState } from 'react';
import type { EmployeePage, FilterOptions, Filters } from '../shared/compensation.ts';
import { api, messageFor } from './api.ts';
import { defaultFilters, EmptyState, ErrorNotice, FilterSelectors, queryFor } from './components.tsx';
import { EmployeePanel } from './employee-panel.tsx';
import { countryName, employeeInitials, money } from './format.ts';

export function Directory({ options }: { options: FilterOptions }) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<EmployeePage>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState<number>();
  const [updatedName, setUpdatedName] = useState('');

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 220);
    return () => clearTimeout(timeout);
  }, [search]);

  const query = queryFor(filters, { q: debouncedSearch, page: String(page) });
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    api<EmployeePage>(`/employees?${query}`, { signal: controller.signal })
      .then(value => { setData(value); setLoading(false); })
      .catch(reason => { if (!controller.signal.aborted) { setError(messageFor(reason)); setLoading(false); } });
    return () => controller.abort();
  }, [query, refresh]);

  const pageCount = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const first = data && data.items.length ? (data.page - 1) * data.pageSize + 1 : 0;
  const last = first && data ? first + data.items.length - 1 : 0;
  return <>
    <div className="page-title"><div><h1>Employees</h1><p>Find an employee, review their pay, or record a salary change.</p></div>
      {data && <span className="count-tag">{data.total.toLocaleString('en')} employees</span>}</div>
    {updatedName && selected === undefined && <div className="notice success" role="status">Salary updated for {updatedName}.</div>}
    <section className="card" aria-label="Employee directory">
      <div className="filters">
        <label className="control search"><span>Search</span>
          <input type="search" placeholder="Find by name or employee ID" value={search}
            onChange={event => setSearch(event.target.value)} maxLength={120} /></label>
        <FilterSelectors filters={filters} options={options} onChange={next => { setFilters(next); setPage(1); }} />
        {(search || filters.country || filters.department) && <button className="button link" type="button"
          onClick={() => { setSearch(''); setDebouncedSearch(''); setFilters(defaultFilters); setPage(1); }}>Clear filters</button>}
      </div>
      {error && <ErrorNotice onRetry={() => setRefresh(value => value + 1)}>{error}</ErrorNotice>}
      {loading && !data && <p className="table-loading" role="status">Loading employees…</p>}
      {data && !error && <>
        {data.items.length === 0 ? <EmptyState title="No employees found" description="Try a different search or clear your filters." /> :
          <div className="table-scroll" tabIndex={0} aria-label="Employee results" aria-busy={loading}>
            <table><thead><tr><th scope="col">Employee</th><th scope="col">Department</th><th scope="col">Country</th>
              <th scope="col" className="numeric">Annual base salary</th><th scope="col"><span className="sr-only">View details</span></th></tr></thead>
              <tbody>{data.items.map(employee => <tr key={employee.id}>
                <td><div className="person-cell"><span className={`avatar tone-${employee.id % 4}`} aria-hidden="true">{employeeInitials(employee.name)}</span>
                  <div><button className="employee-name" type="button" onClick={() => setSelected(employee.id)}>{employee.name}</button>
                    <small>{employee.code} · {employee.title}</small></div></div></td>
                <td>{employee.department}</td><td>{countryName(employee.country)}</td>
                <td className="numeric money">{money(employee.salaryMinor, employee.currency)} <small>{employee.currency}</small></td>
                <td className="view-cell"><button className="button icon arrow" type="button" aria-label={`View ${employee.name}, ${employee.code}`}
                  onClick={() => setSelected(employee.id)}>→</button></td>
              </tr>)}</tbody></table>
          </div>}
        <footer className="table-footer"><span>{first ? `${first.toLocaleString('en')}–${last.toLocaleString('en')} of ${data.total.toLocaleString('en')}` : '0 results'}</span>
          <div className="pagination"><button className="button secondary small" type="button" aria-label="Previous page" disabled={loading || page <= 1} onClick={() => setPage(page - 1)}>←</button>
            <span>Page {data.page} of {pageCount}</span>
            <button className="button secondary small" type="button" aria-label="Next page" disabled={loading || page >= pageCount} onClick={() => setPage(page + 1)}>→</button></div>
        </footer>
      </>}
    </section>
    {selected !== undefined && <EmployeePanel key={selected} id={selected} onClose={() => setSelected(undefined)} onSaved={name => {
      setUpdatedName(name);
      setRefresh(value => value + 1);
    }} />}
  </>;
}
