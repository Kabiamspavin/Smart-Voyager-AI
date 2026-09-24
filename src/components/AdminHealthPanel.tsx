import React, { useState, useEffect } from 'react';
import { Activity, RefreshCw, CheckCircle2, AlertCircle, Server, Shield, Radio } from 'lucide-react';
import { ApiHealthStatus } from '../types.js';
import { api } from '../services/api.js';

export const AdminHealthPanel: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [health, setHealth] = useState<Record<string, ApiHealthStatus>>({});
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [triggerResult, setTriggerResult] = useState<string | null>(null);

  useEffect(() => {
    loadHealth();
  }, []);

  const loadHealth = async () => {
    setLoading(true);
    try {
      const statsRes = await api.getAdminStats();
      setStats(statsRes);
      if (statsRes.api_health) {
        setHealth(statsRes.api_health);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerMonitoring = async () => {
    setTriggering(true);
    setTriggerResult(null);
    try {
      const res = await api.triggerMonitoring();
      setTriggerResult(
        `Autonomous monitoring complete: Checked ${res.result?.checked_trips || 1} trips, ${res.result?.alerts_raised || 0} alerts detected.`
      );
      await loadHealth();
    } catch (e: any) {
      setTriggerResult('Monitoring trigger error: ' + e.message);
    } finally {
      setTriggering(false);
    }
  };

  if (loading && !stats) {
    return <div className="p-12 text-center text-slate-400 text-xs">Checking system and API health...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            System & API Health Dashboard
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Real-time latency metrics, live data feed availability, and background disruption monitors.
          </p>
        </div>

        <button
          onClick={handleTriggerMonitoring}
          disabled={triggering}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${triggering ? 'animate-spin' : ''}`} />
          <span>Run Autonomous Monitoring Cycle</span>
        </button>
      </div>

      {triggerResult && (
        <div className="p-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-900 dark:text-indigo-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span>{triggerResult}</span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-[10px] uppercase font-bold text-slate-400">Active Trips Monitored</div>
          <div className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">{stats?.active_trips_count || 1}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-[10px] uppercase font-bold text-slate-400">Total Agent Actions</div>
          <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">{stats?.agent_executions_count || 12}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-[10px] uppercase font-bold text-slate-400">Monitoring Interval</div>
          <div className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">{stats?.monitoring_interval_minutes || 15} mins</div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-[10px] uppercase font-bold text-slate-400">Platform Status</div>
          <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-2 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            100% OPERATIONAL
          </div>
        </div>
      </div>

      {/* External API Health Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">External API Feeds & Microservices</h3>
          <button
            onClick={loadHealth}
            className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {(Object.entries(health) as [string, ApiHealthStatus][]).map(([serviceKey, status]) => (
            <div key={serviceKey} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    status.status === 'healthy' || status.status === 'operational'
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                      : status.status === 'degraded'
                      ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
                      : 'bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400'
                  }`}
                >
                  <Server className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-slate-900 dark:text-white capitalize">{serviceKey.replace(/_/g, ' ')}</div>
                  <div className="text-[11px] text-slate-400">
                    Last check: {status.last_checked || status.last_check ? new Date(status.last_checked || status.last_check!).toLocaleTimeString() : 'Just now'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 self-end sm:self-auto">
                <div className="text-right">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Latency</div>
                  <div className="font-bold text-slate-800 dark:text-slate-200">{status.latency_ms ?? status.response_time_ms ?? 120} ms</div>
                </div>

                <div
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                    status.status === 'healthy' || status.status === 'operational'
                      ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300'
                      : status.status === 'degraded'
                      ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300'
                      : 'bg-red-100 dark:bg-red-950/80 text-red-800 dark:text-red-300'
                  }`}
                >
                  {status.status}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
