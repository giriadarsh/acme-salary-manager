import { useEffect, useState } from 'react';
import type { FilterOptions, Filters, Report } from '../shared/compensation.ts';
import { api, messageFor } from './api.ts';
import { defaultFilters, EmptyState, ErrorNotice, FilterSelectors, queryFor } from './components.tsx';
import { countryName, money } from './format.ts';

export function Reports({ options }: { options: FilterOptions }) {
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [report, setReport] = useState<Report>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const query = queryFor(filters);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    api<Report>(`/compensation?${query}`, { signal: controller.signal })
      .then(data => { setReport(data); setLoading(false); })
      .catch(reason => { if (!controller.signal.aborted) { setError(messageFor(reason)); setLoading(false); } });
    return () => controller.abort();
  }, [query, retry]);

  return <>
    <div className="page-title"><div><h1>Compensation</h1><p>Compare current annual base pay across countries and departments.</p></div></div>
    <section className="card report-filters" aria-label="Compensation filters">
      <div className="filters"><FilterSelectors filters={filters} options={options} onChange={setFilters} />
        {(filters.country || filters.department) && <button type="button" className="button link" onClick={() => setFilters(defaultFilters)}>Clear filters</button>}
      </div>
    </section>
    {error && <ErrorNotice onRetry={() => setRetry(value => value + 1)}>{error}</ErrorNotice>}
    {loading && <p className="muted" role="status">Loading compensation report…</p>}
    {!loading && !error && report && (report.totals.length === 0 ? <section className="card"><EmptyState
      title="No compensation data" description="Try a different combination of country and department." /></section> : <>
        <section aria-labelledby="report-summary">
          <div className="section-title"><h2 id="report-summary">Payroll by currency</h2><span className="muted">Annual base pay</span></div>
          <div className="currency-grid">{report.totals.map(row => <article className="card metric" key={row.currency} aria-label={`${row.currency} payroll`}>
            <div className="metric-head"><span className="currency-tag">{row.currency}</span>
              <span className="muted">{row.count.toLocaleString('en')} employees</span></div>
            <strong>{money(row.totalMinor, row.currency)}</strong><span className="muted">Median {money(row.medianMinor, row.currency)}</span>
          </article>)}</div>
        </section>
        <section className="card" aria-labelledby="breakdown"><header className="card-heading"><h2 id="breakdown">Country and department breakdown</h2></header>
          <div className="table-scroll" tabIndex={0} aria-label="Compensation breakdown">
            <table><thead><tr><th scope="col">Country</th><th scope="col">Department</th><th scope="col">Currency</th>
              <th scope="col" className="numeric">Employees</th><th scope="col" className="numeric">Median salary</th>
              <th scope="col" className="numeric">Total base pay</th></tr></thead>
              <tbody>{report.groups.map(row => <tr key={`${row.country}-${row.department}-${row.currency}`}>
                <td>{row.country && countryName(row.country)}</td><td>{row.department}</td><td>{row.currency}</td>
                <td className="numeric">{row.count.toLocaleString('en')}</td><td className="numeric money">{money(row.medianMinor, row.currency)}</td>
                <td className="numeric money">{money(row.totalMinor, row.currency)}</td></tr>)}</tbody></table>
          </div>
        </section>
      </>)}
  </>;
}
