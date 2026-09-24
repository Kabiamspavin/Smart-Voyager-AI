import React from 'react';
import { Cpu, CheckCircle2, Clock, Wrench, Shield, Database, Radio, Sparkles } from 'lucide-react';
import { AgentExecutionLog, DataSourceMeta } from '../types.js';

interface AgentActivityPanelProps {
  logs: AgentExecutionLog[];
  dataSources: DataSourceMeta[];
}

export const AgentActivityPanel: React.FC<AgentActivityPanelProps> = ({
  logs,
  dataSources,
}) => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Cpu className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          Autonomous Multi-Agent Activity & Telemetry
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Real-time logs from the 6 specialized AI agents governing constraints, logistics, and data grounding.
        </p>
      </div>

      {/* Agents Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { name: 'Coordinator', role: 'Workflow Orchestration', icon: '🧠', status: 'Active' },
          { name: 'Transportation', role: 'Flights & Trains', icon: '✈️', status: 'Active' },
          { name: 'Accommodation', role: 'Verified Stays', icon: '🏨', status: 'Active' },
          { name: 'Attractions', role: 'Itinerary Clustered', icon: '🏛️', status: 'Active' },
          { name: 'Weather', role: 'Precipitation Guard', icon: '🌦️', status: 'Active' },
          { name: 'Budget', role: 'Threshold Optimizer', icon: '📊', status: 'Active' },
        ].map((ag, idx) => (
          <div key={idx} className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="text-xl mb-1">{ag.icon}</div>
            <div className="font-bold text-xs text-slate-900 dark:text-white">{ag.name}</div>
            <div className="text-[10px] text-slate-400 leading-tight mb-2">{ag.role}</div>
            <div className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              {ag.status}
            </div>
          </div>
        ))}
      </div>

      {/* Execution Logs Timeline */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          Recent Agent Action Logs
        </h3>

        {logs.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            No agent executions logged yet. Launch a new trip plan to view autonomous agent activity.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {logs.map((log) => (
              <div key={log.id} className="py-3 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md text-[11px]">
                      {log.agent_name} Agent
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Duration: {log.duration_ms}ms
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    {log.status}
                  </div>
                </div>

                <p className="text-slate-700 dark:text-slate-300">{log.result_summary}</p>

                <div className="flex items-center gap-1.5 text-[11px] text-slate-400 pt-0.5">
                  <Wrench className="w-3 h-3 text-slate-400" />
                  <span>Tools: {log.tools_used.join(', ')}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Data Source Grounding Transparency */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
          <Database className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          Active Grounding Data Feeds
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Every itinerary decision is grounded in live external APIs or structured destination repositories.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {dataSources.map((ds, idx) => (
            <div key={idx} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 text-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-slate-800 dark:text-slate-200">{ds.source_name}</span>
                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300">
                  {ds.data_status}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Type: <span className="capitalize">{ds.source_type.replace('_', ' ')}</span> &bull; Last Synced: {new Date(ds.retrieved_at).toLocaleTimeString()}
              </div>
              {ds.notes && <div className="text-[10px] text-slate-400 mt-1">{ds.notes}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
