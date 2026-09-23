import Link from 'next/link';
import { requirePage } from '@/lib/auth.ts';
import { canAction } from '@/lib/permissions.ts';
import { adminRoutes } from '@/lib/content.ts';
import { getSettings } from '@/lib/site.ts';
import { formatMoney } from '@/lib/format.ts';
import { saveRoute, deleteRoute, saveStop, deleteStop } from '@/app/actions/content.ts';
import { ActionForm, ConfirmSubmit, RowFilter, Submit } from '../ui.tsx';

export const metadata = { title: 'Bus routes' };

/**
 * Routes and their stops, with the times the transport office actually works to.
 *
 * Parents check this page before they apply, and again on the first morning of every term — so a
 * time that is wrong here is a child standing at the wrong corner.
 */
export default async function TransportPage() {
  const user = await requirePage('TRANSPORT');
  const [routes, school] = await Promise.all([adminRoutes(), getSettings()]);
  const mayManage = canAction(user, 'TRANSPORT_MANAGE');
  const stops = routes.reduce((count, route) => count + route.stops.length, 0);

  return (
    <>
      <div className="panel">
        <header>
          <div>
            <h2>Bus routes</h2>
            <p>{routes.length} route{routes.length === 1 ? '' : 's'} · {stops} stop{stops === 1 ? '' : 's'}</p>
          </div>
          <span style={{ flex: 1 }} />
          <Link href="/school-bus" target="_blank" className="btn btn-ghost btn-xs">View ↗</Link>
        </header>
      </div>

      {mayManage ? (
        <ActionForm action={saveRoute} success="Route added.">
          <div className="panel">
            <header>
              <div><h2>Add a route</h2></div>
              <span style={{ flex: 1 }} />
              <Submit>Add route</Submit>
            </header>
            <div className="body">
              <div className="grid-3">
                <div className="field">
                  <label htmlFor="new-route-code">Code</label>
                  <input id="new-route-code" name="code" type="text" required maxLength={20} placeholder="R5" />
                </div>
                <div className="field">
                  <label htmlFor="new-route-name">Name</label>
                  <input id="new-route-name" name="name" type="text" required maxLength={120} placeholder="Kikuyu – Dagoretti" />
                </div>
                <div className="field">
                  <label htmlFor="new-route-fare">Termly fare ({school.currency_symbol})</label>
                  <input id="new-route-fare" name="fare" type="text" inputMode="decimal" placeholder="12000" />
                </div>
              </div>
              <div className="field">
                <label htmlFor="new-route-desc">Description</label>
                <input id="new-route-desc" name="description" type="text" maxLength={600} placeholder="Along Naivasha Road, with a feeder from Dagoretti Market." />
              </div>
              <div className="grid-2">
                <div className="field">
                  <label htmlFor="new-route-sort">Order</label>
                  <input id="new-route-sort" name="sort" type="number" min={0} max={9999} defaultValue={routes.length} />
                </div>
                <div className="check-row" style={{ alignSelf: 'end' }}>
                  <input id="new-route-pub" name="is_published" type="checkbox" value="1" defaultChecked />
                  <label htmlFor="new-route-pub">Publish</label>
                </div>
              </div>
            </div>
          </div>
        </ActionForm>
      ) : null}

      {routes.length === 0 ? (
        <div className="panel">
          <div className="empty">
            <span className="big" aria-hidden="true">🚌</span>
            <h3>No routes yet</h3>
            <p>The transport page will say route information is being finalised until at least one route is published.</p>
          </div>
        </div>
      ) : (
        <RowFilter placeholder="Search routes and stops…">
          {routes.map((route) => (
            <div className="panel" key={route.id} data-filter-group={`${route.code} ${route.name} ${route.description ?? ''}`}>
              <header>
                <div>
                  <h2>{route.code} — {route.name}</h2>
                  <p>
                    {route.stops.length} stop{route.stops.length === 1 ? '' : 's'}
                    {Number(route.fare_cents) > 0 ? ` · ${formatMoney(Number(route.fare_cents), school.currency_symbol)} a term` : ' · fare charged through the fee structure'}
                  </p>
                </div>
                <span style={{ flex: 1 }} />
                {route.is_published ? <span className="badge badge-ok">Live</span> : <span className="badge badge-warn">Hidden</span>}
              </header>

              <div className="body">
                <ActionForm action={saveRoute} success="Route saved.">
                  <input type="hidden" name="id" value={route.id} />
                  <fieldset disabled={!mayManage} style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 12 }}>
                    <div className="grid-3">
                      <div className="field">
                        <label htmlFor={`rc-${route.id}`}>Code</label>
                        <input id={`rc-${route.id}`} name="code" type="text" required maxLength={20} defaultValue={route.code} />
                      </div>
                      <div className="field">
                        <label htmlFor={`rn-${route.id}`}>Name</label>
                        <input id={`rn-${route.id}`} name="name" type="text" required maxLength={120} defaultValue={route.name} />
                      </div>
                      <div className="field">
                        <label htmlFor={`rf-${route.id}`}>Termly fare</label>
                        <input id={`rf-${route.id}`} name="fare" type="text" inputMode="decimal" defaultValue={(Number(route.fare_cents) / 100).toFixed(0)} />
                      </div>
                    </div>
                    <div className="field">
                      <label htmlFor={`rd-${route.id}`}>Description</label>
                      <input id={`rd-${route.id}`} name="description" type="text" maxLength={600} defaultValue={route.description ?? ''} />
                    </div>
                    <div className="grid-3">
                      <div className="field">
                        <label htmlFor={`rs-${route.id}`}>Order</label>
                        <input id={`rs-${route.id}`} name="sort" type="number" min={0} max={9999} defaultValue={route.sort} />
                      </div>
                      <div className="check-row" style={{ alignSelf: 'end' }}>
                        <input id={`rp-${route.id}`} name="is_published" type="checkbox" value="1" defaultChecked={route.is_published} />
                        <label htmlFor={`rp-${route.id}`}>Publish</label>
                      </div>
                      {mayManage ? <div style={{ alignSelf: 'end' }}><Submit className="btn btn-ghost btn-xs">Save route</Submit></div> : null}
                    </div>
                  </fieldset>
                </ActionForm>

                <h3 style={{ fontSize: '0.88rem', margin: '20px 0 10px' }}>Stops, in order</h3>
                <div className="table-wrap">
                  <table className="list">
                    <thead>
                      <tr><th style={{ width: 50 }}>#</th><th>Stop</th><th>Pick-up</th><th>Drop-off</th><th className="actions">&nbsp;</th></tr>
                    </thead>
                    <tbody>
                      {route.stops.map((stop, index) => (
                        <tr key={stop.id} data-filter={stop.name}>
                          <td colSpan={5} style={{ padding: 0 }}>
                            <ActionForm action={saveStop}>
                              <input type="hidden" name="id" value={stop.id} />
                              <input type="hidden" name="route_id" value={route.id} />
                              <fieldset disabled={!mayManage} style={{ border: 0, padding: '8px 14px', margin: 0, display: 'flex', gap: 10, alignItems: 'end', flexWrap: 'wrap' }}>
                                <span className="help" style={{ minWidth: 20, paddingBottom: 10 }}>{index + 1}</span>
                                <div className="field" style={{ flex: '2 1 200px' }}>
                                  <label htmlFor={`sn-${stop.id}`} className="sr-only">Stop name</label>
                                  <input id={`sn-${stop.id}`} name="name" type="text" required maxLength={120} defaultValue={stop.name} />
                                </div>
                                <div className="field" style={{ flex: '0 1 120px' }}>
                                  <label htmlFor={`sp-${stop.id}`} className="sr-only">Pick-up</label>
                                  <input id={`sp-${stop.id}`} name="pickup_time" type="time" defaultValue={stop.pickup_time ?? ''} />
                                </div>
                                <div className="field" style={{ flex: '0 1 120px' }}>
                                  <label htmlFor={`sd-${stop.id}`} className="sr-only">Drop-off</label>
                                  <input id={`sd-${stop.id}`} name="dropoff_time" type="time" defaultValue={stop.dropoff_time ?? ''} />
                                </div>
                                <div className="field" style={{ flex: '0 1 80px' }}>
                                  <label htmlFor={`ss-${stop.id}`} className="sr-only">Order</label>
                                  <input id={`ss-${stop.id}`} name="sort" type="number" min={0} max={9999} defaultValue={stop.sort} />
                                </div>
                                {mayManage ? <Submit className="btn btn-ghost btn-xs" busy="…">Save</Submit> : null}
                              </fieldset>
                            </ActionForm>
                            {mayManage ? (
                              <div style={{ padding: '0 14px 8px 44px' }}>
                                <ActionForm action={deleteStop}>
                                  <input type="hidden" name="id" value={stop.id} />
                                  <input type="hidden" name="route_id" value={route.id} />
                                  <ConfirmSubmit message={`Remove the ${stop.name} stop?`}>Remove stop</ConfirmSubmit>
                                </ActionForm>
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                      {route.stops.length === 0 ? (
                        <tr data-filter=""><td colSpan={5} className="help" style={{ padding: 14 }}>No stops yet — the website will say they are being confirmed.</td></tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>

                {mayManage ? (
                  <ActionForm action={saveStop}>
                    <input type="hidden" name="route_id" value={route.id} />
                    <div className="toolbar" style={{ marginTop: 12 }}>
                      <div className="grow">
                        <label htmlFor={`new-stop-${route.id}`} className="sr-only">New stop</label>
                        <input id={`new-stop-${route.id}`} name="name" type="text" required maxLength={120} placeholder="Stop name" />
                      </div>
                      <input name="pickup_time" type="time" aria-label="Pick-up time" style={{ width: 120 }} />
                      <input name="dropoff_time" type="time" aria-label="Drop-off time" style={{ width: 120 }} />
                      <input name="sort" type="hidden" value={route.stops.length} />
                      <Submit className="btn btn-ghost btn-xs" busy="…">Add stop</Submit>
                    </div>
                  </ActionForm>
                ) : null}
              </div>

              {mayManage ? (
                <footer>
                  <span className="help" style={{ flex: 1 }}>Deleting a route removes its stops with it.</span>
                  <ActionForm action={deleteRoute}>
                    <input type="hidden" name="id" value={route.id} />
                    <ConfirmSubmit message={`Delete route ${route.code} and its ${route.stops.length} stop(s)?`}>Delete route</ConfirmSubmit>
                  </ActionForm>
                </footer>
              ) : null}
            </div>
          ))}
        </RowFilter>
      )}
    </>
  );
}
