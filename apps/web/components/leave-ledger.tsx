'use client';
import {useEffect,useState} from 'react';
import {operationsApi} from '../lib/api';
import {useAuth} from '../lib/auth-context';
export function LeaveLedger({refreshKey=''}:{refreshKey?:string}){const {session}=useAuth();const [rows,setRows]=useState<any[]>([]),[error,setError]=useState('');useEffect(()=>{if(session)operationsApi.get(session.token,'leave-ledger').then(setRows).catch(e=>setError(e.message));},[session?.token,refreshKey]);return <section className="card"><h2>My leave transactions</h2>{error&&<p role="alert">{error}</p>}<div className="table-wrap"><table><thead><tr><th>Date</th><th>Leave / period</th><th>Transaction</th><th>Days</th><th>Reason</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{r.effectiveDate.slice(0,10)}</td><td>{r.balance.leaveType} / {r.balance.periodKey}</td><td>{r.kind.replaceAll('_',' ')}</td><td>{r.days>0?'+':''}{r.days}</td><td>{r.reason}</td></tr>)}</tbody></table></div></section>;}
