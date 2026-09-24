import { ExpenseItem, MemberBalance, DebtSettlement, AgenticExpenseAuditResult, Trip } from '../types.js';

export interface SplitMemberInfo {
  id?: string;
  name: string;
  avatar_color?: string;
  phone?: string;
  role?: string;
}

/**
 * Calculates equal share per person with rounding.
 */
export function calculateEqualSplitShare(amount: number, count: number): number {
  if (count <= 0 || isNaN(amount) || amount <= 0) return 0;
  return Math.round((amount / count) * 100) / 100;
}

/**
 * Computes individual balances for all group members across all logged expenses.
 */
export function computeMemberBalances(
  expenses: ExpenseItem[],
  members: SplitMemberInfo[]
): MemberBalance[] {
  // Ensure we have a unique list of member names
  const memberMap = new Map<string, { total_paid: number; fair_share_owed: number; info: SplitMemberInfo }>();

  // Initialize with known members
  members.forEach((m) => {
    const cleanName = m.name.trim();
    if (cleanName && !memberMap.has(cleanName)) {
      memberMap.set(cleanName, {
        total_paid: 0,
        fair_share_owed: 0,
        info: m,
      });
    }
  });

  // Ensure default fallback member if list was empty
  if (memberMap.size === 0) {
    memberMap.set('You', {
      total_paid: 0,
      fair_share_owed: 0,
      info: { name: 'You', avatar_color: '#4f46e5' },
    });
  }

  // Iterate over each expense
  expenses.forEach((exp) => {
    const amount = Number(exp.amount) || 0;
    if (amount <= 0) return;

    // Credit payer
    const payerName = exp.paid_by?.trim() || 'You';
    if (!memberMap.has(payerName)) {
      memberMap.set(payerName, {
        total_paid: 0,
        fair_share_owed: 0,
        info: { name: payerName, avatar_color: '#10b981' },
      });
    }
    const payerEntry = memberMap.get(payerName)!;
    payerEntry.total_paid += amount;

    // Determine participating members for the split
    let participants = exp.split_members && exp.split_members.length > 0
      ? exp.split_members
      : exp.participants && exp.participants.length > 0 && !exp.participants.includes('All')
      ? exp.participants
      : Array.from(memberMap.keys());

    // Filter to valid names
    participants = participants.map((p) => p.trim()).filter(Boolean);
    if (participants.length === 0) {
      participants = Array.from(memberMap.keys());
    }

    const sharePerPerson = amount / participants.length;

    // Debit each participant's fair share
    participants.forEach((pName) => {
      if (!memberMap.has(pName)) {
        memberMap.set(pName, {
          total_paid: 0,
          fair_share_owed: 0,
          info: { name: pName, avatar_color: '#64748b' },
        });
      }
      const pEntry = memberMap.get(pName)!;
      pEntry.fair_share_owed += sharePerPerson;
    });
  });

  // Build final array
  return Array.from(memberMap.entries()).map(([name, data]) => {
    const net = Math.round((data.total_paid - data.fair_share_owed) * 100) / 100;
    return {
      member_name: name,
      total_paid: Math.round(data.total_paid),
      fair_share_owed: Math.round(data.fair_share_owed),
      net_balance: net,
      avatar_color: data.info.avatar_color,
      phone: data.info.phone,
    };
  });
}

/**
 * Simplifies mutual group debts into minimal transfer transactions.
 */
export function simplifyDebts(
  balances: MemberBalance[],
  currency: string = 'INR'
): DebtSettlement[] {
  // Separate into debtors (owe money, net < 0) and creditors (owed money, net > 0)
  const debtors: { name: string; amount: number }[] = [];
  const creditors: { name: string; amount: number }[] = [];

  balances.forEach((b) => {
    const net = Math.round(b.net_balance * 100) / 100;
    if (net < -0.5) {
      debtors.push({ name: b.member_name, amount: Math.abs(net) });
    } else if (net > 0.5) {
      creditors.push({ name: b.member_name, amount: net });
    }
  });

  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const settlements: DebtSettlement[] = [];
  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];
    const amount = Math.min(debtor.amount, creditor.amount);

    if (amount > 0.5) {
      settlements.push({
        id: `settle_${dIdx}_${cIdx}_${Date.now()}`,
        from_member: debtor.name,
        to_member: creditor.name,
        amount: Math.round(amount),
        currency,
        is_settled: false,
        description: `Split settlement from ${debtor.name} to ${creditor.name}`,
      });
    }

    debtor.amount -= amount;
    creditor.amount -= amount;

    if (debtor.amount < 0.5) dIdx++;
    if (creditor.amount < 0.5) cIdx++;
  }

  return settlements;
}

/**
 * Prepares a polite WhatsApp / SMS settlement reminder.
 */
export function generateSplitReminderMessage(
  settlement: DebtSettlement,
  tripTitle: string
): string {
  return `Hi ${settlement.from_member}, here is the tour expense split breakdown for "${tripTitle}":\n\nYour fair share balance owed to ${settlement.to_member} is ${settlement.currency} ${settlement.amount.toLocaleString()}.\n\nPlease settle up when convenient. Thanks!`;
}

/**
 * Computes agentic expense telemetry, detecting pacing anomalies, dominant payers, and savings recommendations.
 */
export function computeAgenticExpenseMetrics(
  trip: Trip,
  expenses: ExpenseItem[],
  members: SplitMemberInfo[]
): AgenticExpenseAuditResult {
  const budget = trip.budget_summary;
  const totalBudget = trip.budget || budget.total_budget || 80000;
  const daysCount = Math.max(1, trip.days?.length || 5);
  const totalSpent = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const remainingBudget = Math.max(0, totalBudget - totalSpent);

  // Daily burn rates
  const dailyTarget = Math.round(totalBudget / daysCount);
  const dailyBurnCurrent = Math.round(totalSpent / Math.min(daysCount, 3)); // based on current pacing

  // Projected spend
  const projectedTotalSpend = totalSpent > 0
    ? Math.round(dailyBurnCurrent * daysCount)
    : budget.estimated_cost?.total || totalBudget;
  const projectedDifference = totalBudget - projectedTotalSpend;

  // Pacing status
  let pacingStatus: 'healthy' | 'caution' | 'critical' = 'healthy';
  if (totalSpent > totalBudget * 0.95 || projectedTotalSpend > totalBudget * 1.1) {
    pacingStatus = 'critical';
  } else if (totalSpent > totalBudget * 0.75 || projectedTotalSpend > totalBudget) {
    pacingStatus = 'caution';
  }

  // Category tracking
  const categorySpent: Record<string, number> = {
    Transport: 0,
    Hotel: 0,
    Food: 0,
    Activity: 0,
    'Local Travel': 0,
    Other: 0,
  };

  expenses.forEach((e) => {
    const cat = e.category || 'Other';
    if (categorySpent[cat] !== undefined) {
      categorySpent[cat] += Number(e.amount) || 0;
    } else {
      categorySpent.Other += Number(e.amount) || 0;
    }
  });

  const categoryHealth = [
    {
      category: 'Transport & Flights',
      allocated: budget.estimated_cost?.transport || 28000,
      spent: categorySpent.Transport,
      pacing_pct: Math.round((categorySpent.Transport / (budget.estimated_cost?.transport || 1)) * 100),
      status: (categorySpent.Transport > (budget.estimated_cost?.transport || 1) * 1.05 ? 'exceeded' : categorySpent.Transport > (budget.estimated_cost?.transport || 1) * 0.85 ? 'elevated' : 'good') as 'good' | 'elevated' | 'exceeded',
    },
    {
      category: 'Hotels & Stay',
      allocated: budget.estimated_cost?.accommodation || 22000,
      spent: categorySpent.Hotel,
      pacing_pct: Math.round((categorySpent.Hotel / (budget.estimated_cost?.accommodation || 1)) * 100),
      status: (categorySpent.Hotel > (budget.estimated_cost?.accommodation || 1) * 1.05 ? 'exceeded' : categorySpent.Hotel > (budget.estimated_cost?.accommodation || 1) * 0.85 ? 'elevated' : 'good') as 'good' | 'elevated' | 'exceeded',
    },
    {
      category: 'Dining & Meals',
      allocated: budget.estimated_cost?.food || 14000,
      spent: categorySpent.Food,
      pacing_pct: Math.round((categorySpent.Food / (budget.estimated_cost?.food || 1)) * 100),
      status: (categorySpent.Food > (budget.estimated_cost?.food || 1) * 1.05 ? 'exceeded' : categorySpent.Food > (budget.estimated_cost?.food || 1) * 0.85 ? 'elevated' : 'good') as 'good' | 'elevated' | 'exceeded',
    },
    {
      category: 'Sightseeing & Activities',
      allocated: budget.estimated_cost?.activities || 8500,
      spent: categorySpent.Activity,
      pacing_pct: Math.round((categorySpent.Activity / (budget.estimated_cost?.activities || 1)) * 100),
      status: (categorySpent.Activity > (budget.estimated_cost?.activities || 1) * 1.05 ? 'exceeded' : categorySpent.Activity > (budget.estimated_cost?.activities || 1) * 0.85 ? 'elevated' : 'good') as 'good' | 'elevated' | 'exceeded',
    },
    {
      category: 'Local Cabs & Transit',
      allocated: budget.estimated_cost?.local_transport || 4500,
      spent: categorySpent['Local Travel'],
      pacing_pct: Math.round((categorySpent['Local Travel'] / (budget.estimated_cost?.local_transport || 1)) * 100),
      status: (categorySpent['Local Travel'] > (budget.estimated_cost?.local_transport || 1) * 1.05 ? 'exceeded' : categorySpent['Local Travel'] > (budget.estimated_cost?.local_transport || 1) * 0.85 ? 'elevated' : 'good') as 'good' | 'elevated' | 'exceeded',
    },
  ];

  // Group Member Balances & Fairness Calculation
  const balances = computeMemberBalances(expenses, members);
  const settlements = simplifyDebts(balances, trip.currency || 'INR');

  // Find dominant payer
  let dominantPayer: string | undefined;
  let maxPaid = 0;
  balances.forEach((b) => {
    if (b.total_paid > maxPaid) {
      maxPaid = b.total_paid;
      dominantPayer = b.member_name;
    }
  });

  const payerSharePct = totalSpent > 0 ? (maxPaid / totalSpent) * 100 : 0;
  // Fairness score (100 is perfectly distributed, decreases if 1 person covers >70%)
  const fairnessScore = totalSpent === 0 ? 100 : Math.max(20, Math.round(100 - Math.max(0, payerSharePct - 35) * 1.2));

  // Anomalies Detection
  const anomalies: string[] = [];
  if (payerSharePct > 70 && members.length > 1) {
    anomalies.push(`Uneven Payment Load: ${dominantPayer} has fronted ${Math.round(payerSharePct)}% of all group expenses.`);
  }

  const diningHealth = categoryHealth.find((c) => c.category === 'Dining & Meals');
  if (diningHealth && diningHealth.pacing_pct > 75) {
    anomalies.push(`Food burn rate is pacing high (${diningHealth.pacing_pct}% consumed).`);
  }

  if (pacingStatus === 'caution') {
    anomalies.push(`Current spending velocity threatens the ₹${remainingBudget.toLocaleString()} safety reserve.`);
  }

  if (expenses.length === 0) {
    anomalies.push('Zero live expenses recorded yet. Flight or hotel deposits should be logged to maintain pacing accuracy.');
  }

  // Recommendations
  const recommendations: string[] = [];
  if (settlements.length > 0) {
    recommendations.push(`Execute ${settlements.length} settlement transfer${settlements.length > 1 ? 's' : ''} to restore fair group financial parity.`);
  }
  if (remainingBudget > totalBudget * 0.4) {
    recommendations.push(`Healthy surplus reserve: ₹${remainingBudget.toLocaleString()} available for premium dining or guided heritage excursions.`);
  } else {
    recommendations.push(`Budget buffer tight: prioritize pre-booked metro transit over on-demand surge cabs.`);
  }
  if (dominantPayer && payerSharePct > 60) {
    recommendations.push(`Recommend having other companions (such as ${members.find((m) => m.name !== dominantPayer)?.name || 'other members'}) pay for next major group meals.`);
  }

  return {
    pacing_status: pacingStatus,
    burn_rate_daily: dailyBurnCurrent,
    burn_rate_target_daily: dailyTarget,
    projected_total_spend: projectedTotalSpend,
    projected_savings_or_deficit: projectedDifference,
    fairness_score_percent: fairnessScore,
    dominant_payer: dominantPayer,
    anomalies_detected: anomalies,
    settlement_instructions: settlements.map((s) => ({
      from: s.from_member,
      to: s.to_member,
      amount: s.amount,
      reason: `Fair share settlement (${trip.currency || 'INR'} ${s.amount.toLocaleString()})`,
    })),
    agentic_recommendations: recommendations,
    category_health: categoryHealth,
    audit_timestamp: new Date().toISOString(),
  };
}
