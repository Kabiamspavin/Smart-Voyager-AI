import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  PlusCircle,
  Trash2,
  PieChart,
  ShieldCheck,
  CreditCard,
  Layers,
  Train,
  Bus,
  Plane,
  RefreshCw,
  Sparkles,
  Users,
  CheckCircle2,
  Send,
  Check,
  Copy,
  Receipt,
  Scale,
  ArrowRight,
  TrendingDown,
  Info,
} from 'lucide-react';
import { Trip, ExpenseItem, AgenticExpenseAuditResult } from '../types.js';
import { api } from '../services/api.js';
import { adaptItineraryToTransport } from '../utils/scheduleAdapter.js';
import {
  computeMemberBalances,
  simplifyDebts,
  generateSplitReminderMessage,
  computeAgenticExpenseMetrics,
  calculateEqualSplitShare,
  SplitMemberInfo,
} from '../utils/budgetSplitter.js';

interface BudgetDashboardProps {
  trip: Trip;
  currentCurrency: string;
  onTripUpdated: (updatedTrip: Trip) => void;
}

export const BudgetDashboard: React.FC<BudgetDashboardProps> = ({
  trip,
  currentCurrency,
  onTripUpdated,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'splitter' | 'agentic'>('splitter');
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [rates, setRates] = useState<Record<string, number>>({ INR: 1 });
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [agentAudit, setAgentAudit] = useState<AgenticExpenseAuditResult | null>(null);

  // Form State for Expense & Splitter
  const [category, setCategory] = useState<any>('Food');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState('Kavi');
  const [splitEqually, setSplitEqually] = useState(true);
  const [selectedSplitMembers, setSelectedSplitMembers] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  // Extract group members from trip
  const groupMembers: SplitMemberInfo[] = React.useMemo(() => {
    if (trip.tour_members && trip.tour_members.length > 0) {
      return trip.tour_members.map((m) => ({
        id: m.id,
        name: m.name,
        phone: m.phone,
        avatar_color: m.avatar_color || '#4f46e5',
        role: m.role || 'Member',
      }));
    }
    if (trip.members && trip.members.length > 0) {
      return trip.members.map((m) => ({
        id: m.id,
        name: m.name,
        phone: m.phone || '+91 98000 00000',
        avatar_color: '#4f46e5',
        role: 'Member',
      }));
    }
    return [
      { id: 'm1', name: 'Kavi', phone: '+91 98765 43210', avatar_color: '#4f46e5', role: 'Tour Lead' },
      { id: 'm2', name: 'Pavin', phone: '+91 98111 22334', avatar_color: '#06b6d4', role: 'Member' },
      { id: 'm3', name: 'Aarav', phone: '+91 98222 33445', avatar_color: '#10b981', role: 'Member' },
      { id: 'm4', name: 'Meera', phone: '+91 98333 44556', avatar_color: '#f59e0b', role: 'Member' },
    ];
  }, [trip]);

  // Set default paidBy and selected members once groupMembers is ready
  useEffect(() => {
    if (groupMembers.length > 0) {
      if (!groupMembers.some((m) => m.name === paidBy)) {
        setPaidBy(groupMembers[0].name);
      }
      setSelectedSplitMembers(groupMembers.map((m) => m.name));
    }
  }, [groupMembers]);

  useEffect(() => {
    loadExpenses();
    loadRates();
  }, [trip.id, currentCurrency]);

  // Recalculate baseline agentic metrics whenever expenses or trip changes
  useEffect(() => {
    const baseline = computeAgenticExpenseMetrics(trip, expenses, groupMembers);
    setAgentAudit(baseline);
  }, [expenses, trip, groupMembers]);

  const loadExpenses = async () => {
    try {
      const res = await api.getExpenses(trip.id);
      setExpenses(res.expenses || []);
    } catch (e) {
      console.error(e);
    }
  };

  const loadRates = async () => {
    try {
      const res = await api.getLiveCurrency('INR');
      if (res.rates) {
        setRates(res.rates);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const convertCost = (inrAmount: number) => {
    if (currentCurrency === 'INR') return inrAmount;
    const rate = rates[currentCurrency] || 1;
    return Math.round(inrAmount * rate);
  };

  // Run full Agentic Audit via server
  const handleRunAgenticAudit = async () => {
    setIsAuditing(true);
    try {
      const res = await api.auditExpenses(trip.id, trip);
      if (res.audit) {
        setAgentAudit(res.audit);
      }
    } catch (err) {
      console.warn('Agentic audit call fallback:', err);
      const fallback = computeAgenticExpenseMetrics(trip, expenses, groupMembers);
      setAgentAudit(fallback);
    } finally {
      setIsAuditing(false);
    }
  };

  const handleOptimizeBudget = async () => {
    setIsOptimizing(true);
    try {
      const res = await api.optimizeBudget(trip.id);
      if (res.trip) {
        onTripUpdated(res.trip);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleSwitchMode = async (mode: string) => {
    setIsOptimizing(true);
    const target = (trip.transport_options || []).find((t) => t.mode === mode);
    try {
      const res = await api.switchTransport(trip.id, { mode, trip });
      if (res.trip) {
        const adapted = target ? adaptItineraryToTransport(res.trip, target, res.trip.selected_hotel) : null;
        const finalTrip = adapted && adapted.updatedDays.length > 0
          ? { ...res.trip, days: adapted.updatedDays }
          : res.trip;
        onTripUpdated(finalTrip);
        setIsOptimizing(false);
        return;
      }
    } catch (e) {
      console.warn('API switch transport error in budget dashboard, applying local fallback:', e);
    }

    if (target) {
      const updatedTrip = { ...trip };
      updatedTrip.selected_transport = target;
      const { updatedDays } = adaptItineraryToTransport(updatedTrip, target, updatedTrip.selected_hotel);
      updatedTrip.days = updatedDays;
      onTripUpdated(updatedTrip);
    }
    setIsOptimizing(false);
  };

  // Handle Adding Expense with Group Split
  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) return;

    try {
      const numAmount = Number(amount);
      const activeMembers = splitEqually
        ? groupMembers.map((m) => m.name)
        : selectedSplitMembers.length > 0
        ? selectedSplitMembers
        : groupMembers.map((m) => m.name);

      const perShare = calculateEqualSplitShare(numAmount, activeMembers.length);

      const res = await api.addExpense(trip.id, {
        category,
        description: description.trim() || category,
        amount: numAmount,
        currency: currentCurrency,
        paid_by: paidBy,
        participants: activeMembers,
        split_type: 'equal',
        split_members: activeMembers,
        per_member_share: perShare,
        notes: notes.trim(),
        is_settled: false,
      });

      const newExpense = res.expense;
      setExpenses((prev) => [newExpense, ...prev]);

      // Update trip spent_actual
      const updatedTrip = {
        ...trip,
        budget_summary: {
          ...trip.budget_summary,
          spent_actual: (trip.budget_summary.spent_actual || 0) + numAmount,
          remaining_budget: Math.max(0, (trip.budget || 80000) - ((trip.budget_summary.spent_actual || 0) + numAmount)),
        },
      };
      onTripUpdated(updatedTrip);

      // Reset form
      setDescription('');
      setAmount('');
      setNotes('');
      setShowAddForm(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteExpense = async (id: string, expAmount: number) => {
    try {
      await api.deleteExpense(trip.id, id);
      setExpenses((prev) => prev.filter((x) => x.id !== id));
      const updatedTrip = {
        ...trip,
        budget_summary: {
          ...trip.budget_summary,
          spent_actual: Math.max(0, (trip.budget_summary.spent_actual || 0) - expAmount),
          remaining_budget: Math.min(trip.budget || 80000, (trip.budget_summary.remaining_budget || 0) + expAmount),
        },
      };
      onTripUpdated(updatedTrip);
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Settle Up between two members
  const handleSettleDebt = async (fromMember: string, toMember: string, settleAmount: number) => {
    setSettlingId(`${fromMember}_${toMember}`);
    try {
      const res = await api.settleDebt(trip.id, fromMember, toMember, settleAmount, trip.currency || 'INR');
      if (res.settlementExpense) {
        setExpenses((prev) => [res.settlementExpense, ...prev]);
      }
    } catch (err) {
      console.error('Failed to record settlement:', err);
    } finally {
      setTimeout(() => setSettlingId(null), 800);
    }
  };

  // Copy Reminder Message to Clipboard
  const handleCopyReminder = (msg: string, id: string) => {
    navigator.clipboard.writeText(msg);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Toggle member inclusion in split
  const toggleMemberSplit = (memberName: string) => {
    setSelectedSplitMembers((prev) => {
      if (prev.includes(memberName)) {
        if (prev.length <= 1) return prev; // Keep at least one
        return prev.filter((m) => m !== memberName);
      } else {
        return [...prev, memberName];
      }
    });
  };

  // Balances & Settlements calculation
  const memberBalances = React.useMemo(() => {
    return computeMemberBalances(expenses, groupMembers);
  }, [expenses, groupMembers]);

  const debtSettlements = React.useMemo(() => {
    return simplifyDebts(memberBalances, trip.currency || 'INR');
  }, [memberBalances, trip.currency]);

  // Total group spending
  const totalLoggedSpend = React.useMemo(() => {
    return expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }, [expenses]);

  const budget = trip.budget_summary;
  const usagePercentage = Math.min(100, Math.round(((budget.spent_actual || totalLoggedSpend) / (trip.budget || 1)) * 100));

  const categories = [
    { label: 'Transportation & Flights', amount: budget.estimated_cost?.transport || 28000, color: 'bg-indigo-500' },
    { label: 'Hotels & Accommodation', amount: budget.estimated_cost?.accommodation || 22000, color: 'bg-blue-500' },
    { label: 'Dining & Food', amount: budget.estimated_cost?.food || 14000, color: 'bg-amber-500' },
    { label: 'Sightseeing & Activities', amount: budget.estimated_cost?.activities || 8500, color: 'bg-emerald-500' },
    { label: 'Local Transit / Cabs', amount: budget.estimated_cost?.local_transport || 4500, color: 'bg-cyan-500' },
    { label: 'Miscellaneous & Contingency', amount: budget.estimated_cost?.miscellaneous || 2000, color: 'bg-slate-400' },
  ];

  const currentSharePreview = React.useMemo(() => {
    const num = Number(amount) || 0;
    const count = splitEqually ? groupMembers.length : Math.max(1, selectedSplitMembers.length);
    return calculateEqualSplitShare(num, count);
  }, [amount, splitEqually, groupMembers.length, selectedSplitMembers.length]);

  return (
    <div className="space-y-6">
      {/* Header & Sub-Tab Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Scale className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Budget & Equal Expense Splitter
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Equal group member splitting with autonomous agentic financial tracking
              </p>
            </div>
          </div>
        </div>

        {/* View Switcher Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl self-start sm:self-auto">
          <button
            onClick={() => setActiveSubTab('splitter')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === 'splitter'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Group Splitter</span>
            {debtSettlements.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 font-bold">
                {debtSettlements.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSubTab('agentic')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === 'agentic'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            <span>Agentic Auditor</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </button>

          <button
            onClick={() => setActiveSubTab('overview')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === 'overview'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <PieChart className="w-3.5 h-3.5" />
            <span>Overview & Allocations</span>
          </button>
        </div>
      </div>

      {/* Top Telemetry Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Budget Card */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1 flex items-center justify-between">
            <span>Set Budget Cap</span>
            <DollarSign className="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <div className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
            {currentCurrency} {convertCost(trip.budget || 80000).toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
            4 travellers &bull; ₹{Math.round((trip.budget || 80000) / (trip.travellers_count || 4)).toLocaleString()} / person
          </div>
        </div>

        {/* Total Spent Card */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1 flex items-center justify-between">
            <span>Total Actual Spent</span>
            <Receipt className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
            {currentCurrency} {convertCost(budget.spent_actual || totalLoggedSpend).toLocaleString()}
          </div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-1">
            {usagePercentage}% of total limit logged
          </div>
        </div>

        {/* Group Equal Share Card */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1 flex items-center justify-between">
            <span>Equal Share / Member</span>
            <Users className="w-3.5 h-3.5 text-cyan-500" />
          </div>
          <div className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
            {currentCurrency} {convertCost(Math.round(totalLoggedSpend / Math.max(1, groupMembers.length))).toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
            Split across {groupMembers.length} active members
          </div>
        </div>

        {/* Agentic Pacing Health */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1 flex items-center justify-between">
            <span>Agentic Health</span>
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                agentAudit?.pacing_status === 'critical'
                  ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300'
                  : agentAudit?.pacing_status === 'caution'
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
              }`}
            >
              {agentAudit?.pacing_status || 'HEALTHY'}
            </span>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {agentAudit?.fairness_score_percent || 100}% Fair
            </span>
          </div>
          <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
            Daily Burn: ₹{(agentAudit?.burn_rate_daily || 0).toLocaleString()}/day
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SUB-TAB 1: GROUP BUDGET SPLITTER & BALANCES             */}
      {/* ======================================================== */}
      {activeSubTab === 'splitter' && (
        <div className="space-y-6">
          {/* Group Equal Split Highlights Banner */}
          <div className="bg-gradient-to-r from-indigo-50 via-blue-50 to-indigo-50 dark:from-indigo-950/40 dark:via-blue-950/30 dark:to-indigo-950/40 p-4 sm:p-5 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-600 text-white">
                  Equal Split Engine
                </span>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {groupMembers.length} Tour Members Linked
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Every logged expense is automatically divided equally among members. The system keeps live track of who fronted cash, who owes, and generates minimal-transfer settlements.
              </p>
            </div>

            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-indigo-100 dark:shadow-indigo-950 transition-all cursor-pointer whitespace-nowrap self-start md:self-auto"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Log & Split Expense</span>
            </button>
          </div>

          {/* Member Balances Ledger ("Who Owes What") */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Group Member Balances</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Individual spend contribution vs fair equal share breakdown
                </p>
              </div>

              <div className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
                Total Expenses: <strong className="text-slate-900 dark:text-white">₹{totalLoggedSpend.toLocaleString()}</strong>
              </div>
            </div>

            {/* Member Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {memberBalances.map((mb, idx) => {
                const isOverpaid = mb.net_balance > 0.5;
                const isUnderpaid = mb.net_balance < -0.5;
                const isEven = !isOverpaid && !isUnderpaid;

                return (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-850/60 flex flex-col justify-between"
                  >
                    <div className="flex items-center gap-2.5 mb-2">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-xs"
                        style={{ backgroundColor: mb.avatar_color || '#4f46e5' }}
                      >
                        {mb.member_name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                          {mb.member_name}
                        </div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                          {mb.phone || 'Trip Member'}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1 py-1.5 border-t border-b border-slate-200/60 dark:border-slate-800 text-[11px]">
                      <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                        <span>Paid for group:</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          ₹{mb.total_paid.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                        <span>Fair share owed:</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          ₹{mb.fair_share_owed.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                        Net Status:
                      </span>
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                          isOverpaid
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            : isUnderpaid
                            ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {isOverpaid && `+₹${Math.round(mb.net_balance).toLocaleString()} to receive`}
                        {isUnderpaid && `-₹${Math.round(Math.abs(mb.net_balance)).toLocaleString()} to pay`}
                        {isEven && 'Settled (₹0)'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Optimal Debt Settlement Matrix ("Who Pays Whom") */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Smart Settlement Matrix</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Minimal transaction solver to settle all equal split debts with 1-click reminders
                </p>
              </div>

              {debtSettlements.length === 0 && (
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-lg">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>All Balances Settled Up</span>
                </span>
              )}
            </div>

            {debtSettlements.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-850/50 rounded-xl">
                No outstanding group debts! Everyone has contributed equally or all splits are square.
              </div>
            ) : (
              <div className="space-y-2.5">
                {debtSettlements.map((settle, sIdx) => {
                  const reminderMsg = generateSplitReminderMessage(settle, trip.title);
                  const isSettling = settlingId === `${settle.from_member}_${settle.to_member}`;
                  const fromMemberObj = groupMembers.find((m) => m.name === settle.from_member);
                  const cleanPhone = fromMemberObj?.phone?.replace(/\D/g, '') || '';
                  const waUrl = cleanPhone
                    ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(reminderMsg)}`
                    : `https://wa.me/?text=${encodeURIComponent(reminderMsg)}`;

                  return (
                    <div
                      key={settle.id || sIdx}
                      className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-850/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center text-xs font-bold shrink-0">
                          {settle.from_member.charAt(0)}
                        </div>

                        <div>
                          <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                            <span className="text-amber-700 dark:text-amber-300">{settle.from_member}</span>
                            <ArrowRight className="w-3 h-3 text-slate-400" />
                            <span className="text-emerald-700 dark:text-emerald-300">{settle.to_member}</span>
                            <span className="font-extrabold text-slate-900 dark:text-white ml-1">
                              ₹{settle.amount.toLocaleString()}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                            Equal split reimbursement for shared tour bookings
                          </div>
                        </div>
                      </div>

                      {/* Action buttons: Settle Up & Send Reminder */}
                      <div className="flex items-center gap-2 shrink-0">
                        {/* WhatsApp / SMS Reminder */}
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 hover:text-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1.5 rounded-lg transition-colors"
                          title="Send split reminder on WhatsApp"
                        >
                          <Send className="w-3 h-3" />
                          <span>WhatsApp</span>
                        </a>

                        {/* Copy Breakdown */}
                        <button
                          onClick={() => handleCopyReminder(reminderMsg, settle.id)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                          title="Copy settlement text to clipboard"
                        >
                          {copiedId === settle.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-500" />
                              <span className="text-emerald-600">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>

                        {/* Settle Up Action */}
                        <button
                          onClick={() => handleSettleDebt(settle.from_member, settle.to_member, settle.amount)}
                          disabled={isSettling}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg shadow-2xs transition-colors cursor-pointer disabled:opacity-60"
                        >
                          {isSettling ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-3 h-3" />
                          )}
                          <span>{isSettling ? 'Settling...' : 'Mark Settled'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add Expense Form Modal / Inline Box */}
          {showAddForm && (
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border-2 border-indigo-500/40 dark:border-indigo-500/30 shadow-lg space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400">
                    <PlusCircle className="w-4 h-4" />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Log New Group Expense & Equal Split
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Calculates exact per-head shares and logs into the agentic tracker
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-semibold cursor-pointer"
                >
                  ✕ Close
                </button>
              </div>

              <form onSubmit={handleAddExpense} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Category */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Expense Category
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium cursor-pointer"
                    >
                      <option value="Food">Dining & Food</option>
                      <option value="Transport">Transportation / Flights</option>
                      <option value="Hotel">Hotel Accommodation</option>
                      <option value="Activity">Sightseeing & Tickets</option>
                      <option value="Local Travel">Local Cabs & Metro</option>
                      <option value="Shopping">Shopping & Souvenirs</option>
                      <option value="Other">Other / Miscellaneous</option>
                    </select>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Description
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Karim's Mughal Dinner or Metro Smartcards"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium"
                      required
                    />
                  </div>

                  {/* Total Amount */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Total Amount ({currentCurrency})
                    </label>
                    <input
                      type="number"
                      placeholder="0"
                      min="1"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium"
                      required
                    />
                  </div>
                </div>

                {/* Split Configuration */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        Who Paid?
                      </span>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">
                        Select the companion who initially covered the bill
                      </p>
                    </div>

                    <select
                      value={paidBy}
                      onChange={(e) => setPaidBy(e.target.value)}
                      className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold cursor-pointer"
                    >
                      {groupMembers.map((m) => (
                        <option key={m.name} value={m.name}>
                          {m.name} ({m.role || 'Member'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        Split Mode
                      </span>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">
                        Equally split among group members
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSplitEqually(true);
                          setSelectedSplitMembers(groupMembers.map((m) => m.name));
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          splitEqually
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        All Members ({groupMembers.length})
                      </button>

                      <button
                        type="button"
                        onClick={() => setSplitEqually(false)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          !splitEqually
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        Select Subset
                      </button>
                    </div>
                  </div>

                  {/* Member Selection Chips (if subset) */}
                  {!splitEqually && (
                    <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800">
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                        Included in this split:
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {groupMembers.map((m) => {
                          const isIncluded = selectedSplitMembers.includes(m.name);
                          return (
                            <button
                              type="button"
                              key={m.name}
                              onClick={() => toggleMemberSplit(m.name)}
                              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                                isIncluded
                                  ? 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700'
                                  : 'bg-white dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700 opacity-60'
                              }`}
                            >
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.avatar_color }} />
                              <span>{m.name}</span>
                              {isIncluded && <Check className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Real-time Share Calculation Pill */}
                  {Number(amount) > 0 && (
                    <div className="p-2.5 rounded-lg bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 flex items-center justify-between text-xs">
                      <span className="text-indigo-900 dark:text-indigo-200 font-medium flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        <span>Calculated Fair Share:</span>
                      </span>
                      <span className="font-extrabold text-indigo-700 dark:text-indigo-300">
                        {currentCurrency} {currentSharePreview.toLocaleString()} / member ({splitEqually ? groupMembers.length : selectedSplitMembers.length} pax)
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-md shadow-indigo-100 dark:shadow-indigo-950 transition-all cursor-pointer"
                  >
                    Save & Split Expense
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Group Expenses List */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Shared Expense Ledger ({expenses.length})
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Real-time equal splits logged across all tour companions
                </p>
              </div>

              {!showAddForm && (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Add Expense</span>
                </button>
              )}
            </div>

            {expenses.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">
                No expenses logged yet. Tap "Log & Split Expense" above to record tickets, lunch, or taxi rides.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {expenses.map((exp) => {
                  const splitList = exp.split_members || exp.participants || ['All'];
                  const perPerson = exp.per_member_share || calculateEqualSplitShare(exp.amount, splitList.length);

                  return (
                    <div key={exp.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {exp.description}
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 capitalize">
                            {exp.category}
                          </span>
                          {exp.is_settled && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300">
                              Settlement Record
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 flex-wrap">
                          <span>{exp.date}</span>
                          <span>&bull;</span>
                          <span>
                            Paid by <strong className="text-slate-700 dark:text-slate-300">{exp.paid_by}</strong>
                          </span>
                          <span>&bull;</span>
                          <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                            Split ({splitList.length} pax): ₹{perPerson.toLocaleString()} / person
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-auto">
                        <div className="text-right">
                          <span className="font-bold text-sm text-slate-900 dark:text-white">
                            {currentCurrency} {convertCost(exp.amount).toLocaleString()}
                          </span>
                          <div className="text-[10px] text-slate-400 dark:text-slate-500">
                            (₹{perPerson.toLocaleString()} each)
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeleteExpense(exp.id, exp.amount)}
                          className="text-slate-300 dark:text-slate-600 hover:text-red-600 dark:hover:text-red-400 transition-colors p-1 cursor-pointer"
                          title="Delete expense"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SUB-TAB 2: AGENTIC EXPENSE AUDITOR & TRACKER             */}
      {/* ======================================================== */}
      {activeSubTab === 'agentic' && (
        <div className="space-y-6">
          {/* Agentic Banner & Live Trigger */}
          <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white p-5 rounded-2xl border border-indigo-800/50 shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-400/30">
                    <Sparkles className="w-4 h-4" />
                  </span>
                  <h3 className="text-base font-bold">
                    Autonomous Agentic Expense Auditor
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Gemini 3.8-Flash
                  </span>
                </div>
                <p className="text-xs text-indigo-200/80 leading-relaxed max-w-2xl">
                  Continuously audits real-time expenses against the ₹{(trip.budget || 80000).toLocaleString()} cap, identifies category burn rate drifts, verifies group payment fairness, and recommends immediate budget balancing interventions.
                </p>
              </div>

              <button
                onClick={handleRunAgenticAudit}
                disabled={isAuditing}
                className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-indigo-900/50 transition-all cursor-pointer whitespace-nowrap self-start sm:self-auto disabled:opacity-60"
              >
                {isAuditing ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <Sparkles className="w-4 h-4 text-amber-300" />
                )}
                <span>{isAuditing ? 'Running Agentic Audit...' : 'Re-Run Live Audit'}</span>
              </button>
            </div>
          </div>

          {/* Audit Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Pacing & Daily Burn */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="text-xs font-bold text-slate-900 dark:text-white mb-2 flex items-center justify-between">
                <span>Burn Rate Velocity</span>
                <TrendingUp className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Current Daily Burn:</span>
                  <strong className="text-slate-900 dark:text-white">
                    ₹{(agentAudit?.burn_rate_daily || 0).toLocaleString()} / day
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Target Budget Rate:</span>
                  <strong className="text-slate-900 dark:text-white">
                    ₹{(agentAudit?.burn_rate_target_daily || 16000).toLocaleString()} / day
                  </strong>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">Projected Spend:</span>
                  <strong className="text-slate-900 dark:text-white">
                    ₹{(agentAudit?.projected_total_spend || trip.budget || 80000).toLocaleString()}
                  </strong>
                </div>
              </div>
            </div>

            {/* Fairness & Distribution */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="text-xs font-bold text-slate-900 dark:text-white mb-2 flex items-center justify-between">
                <span>Group Payment Parity</span>
                <Users className="w-4 h-4 text-cyan-500" />
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 dark:text-slate-400">Fairness Index:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {agentAudit?.fairness_score_percent || 100}% Fair
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{ width: `${agentAudit?.fairness_score_percent || 100}%` }}
                  />
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Primary Payer: <strong className="text-slate-700 dark:text-slate-300">{agentAudit?.dominant_payer || 'Balanced'}</strong>
                </div>
              </div>
            </div>

            {/* Projected Safety Reserve */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="text-xs font-bold text-slate-900 dark:text-white mb-2 flex items-center justify-between">
                <span>Contingency Reserve</span>
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-lg font-bold text-slate-900 dark:text-white">
                ₹{((trip.budget || 80000) - (budget.spent_actual || totalLoggedSpend)).toLocaleString()}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Remaining emergency cash reserve for unexpected transit or weather shifts
              </p>
            </div>
          </div>

          {/* Anomaly Detection & Warnings */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span>Agentic Anomaly Detection</span>
            </h3>

            {agentAudit?.anomalies_detected && agentAudit.anomalies_detected.length > 0 ? (
              <div className="space-y-2">
                {agentAudit.anomalies_detected.map((anomaly, aIdx) => (
                  <div
                    key={aIdx}
                    className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2"
                  >
                    <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <span>{anomaly}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Zero financial anomalies detected. Spending velocity is completely within target tolerance.</span>
              </div>
            )}
          </div>

          {/* Agentic Recommendations */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Agentic Expense Guidance & Action Items</span>
            </h3>

            <div className="space-y-2">
              {agentAudit?.agentic_recommendations && agentAudit.agentic_recommendations.length > 0 ? (
                agentAudit.agentic_recommendations.map((rec, rIdx) => (
                  <div
                    key={rIdx}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200/60 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 flex items-start gap-2.5"
                  >
                    <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                      {rIdx + 1}
                    </span>
                    <span className="leading-relaxed">{rec}</span>
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-400 dark:text-slate-500 py-3">
                  Log additional meal and cab expenses to unlock dynamic agentic recommendations.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SUB-TAB 3: OVERVIEW & CATEGORY ALLOCATIONS               */}
      {/* ======================================================== */}
      {activeSubTab === 'overview' && (
        <div className="space-y-6">
          {/* Progress Bar & Status */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Budget Consumption ({usagePercentage}%)
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  budget.status === 'over_budget'
                    ? 'bg-red-500 text-white'
                    : budget.status === 'warning'
                    ? 'bg-amber-500 text-white'
                    : 'bg-emerald-500 text-white'
                }`}
              >
                {budget.status.replace('_', ' ')}
              </span>
            </div>

            <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mb-3">
              <div
                className={`h-full transition-all duration-500 ${
                  usagePercentage > 95 ? 'bg-red-500' : usagePercentage > 80 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(usagePercentage, 100)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Spent: ₹{(budget.spent_actual || totalLoggedSpend).toLocaleString('en-IN')}</span>
              <span>Remaining: ₹{Math.max(0, (trip.budget || 80000) - (budget.spent_actual || totalLoggedSpend)).toLocaleString('en-IN')}</span>
            </div>
          </div>

          {/* Category Cost Breakdown */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <PieChart className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Category Allocation</span>
            </h3>

            <div className="space-y-3">
              {categories.map((cat, idx) => {
                const totalCost = budget.estimated_cost?.total || trip.budget || 80000;
                const pct = Math.round((cat.amount / totalCost) * 100) || 0;
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-700 dark:text-slate-300 font-medium">{cat.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {currentCurrency} {convertCost(cat.amount).toLocaleString()}
                        </span>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500">({pct}%)</span>
                      </div>
                    </div>
                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className={`h-full ${cat.color}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Mode Rebalance */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Transport Mode Rebalance</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Instantly switch flight or train to optimize trip expenditure
                </p>
              </div>

              <button
                onClick={handleOptimizeBudget}
                disabled={isOptimizing}
                className="flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                {isOptimizing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>Auto-Optimize</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                onClick={() => handleSwitchMode('flight')}
                className={`p-3 rounded-xl border text-left text-xs font-medium flex items-center justify-between cursor-pointer ${
                  trip.selected_transport?.mode === 'flight'
                    ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Plane className="w-4 h-4 text-indigo-600" />
                  <span>Direct Flight</span>
                </div>
                <span className="font-bold">₹28,000</span>
              </button>

              <button
                onClick={() => handleSwitchMode('train')}
                className={`p-3 rounded-xl border text-left text-xs font-medium flex items-center justify-between cursor-pointer ${
                  trip.selected_transport?.mode === 'train'
                    ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Train className="w-4 h-4 text-emerald-600" />
                  <span>Rajdhani Express</span>
                </div>
                <span className="font-bold">₹10,400</span>
              </button>

              <button
                onClick={() => handleSwitchMode('bus')}
                className={`p-3 rounded-xl border text-left text-xs font-medium flex items-center justify-between cursor-pointer ${
                  trip.selected_transport?.mode === 'bus'
                    ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Bus className="w-4 h-4 text-amber-600" />
                  <span>Express Volvo</span>
                </div>
                <span className="font-bold">₹7,200</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
