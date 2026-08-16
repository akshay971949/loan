/**
 * EMI utilities: standard reducing-balance EMI formula and full schedule generation.
 * Interest rate is taken as a MONTHLY percentage (not annual).
 */

// EMI = P * r * (1+r)^n / ((1+r)^n - 1)
// P = principal, r = monthly interest rate (decimal), n = tenure in months
function calculateEMI(principal, monthlyRatePercent, tenureMonths) {
  const r = monthlyRatePercent / 100;
  if (r === 0) {
    return +(principal / tenureMonths).toFixed(2);
  }
  const factor = Math.pow(1 + r, tenureMonths);
  const emi = (principal * r * factor) / (factor - 1);
  return +emi.toFixed(2);
}

// Generates a full amortization schedule: one row per month with
// due date, principal/interest split, and closing balance.
function generateSchedule(principal, monthlyRatePercent, tenureMonths, startDate) {
  const r = monthlyRatePercent / 100;
  const emi = calculateEMI(principal, monthlyRatePercent, tenureMonths);
  let balance = principal;
  const schedule = [];

  const start = new Date(startDate);

  for (let i = 1; i <= tenureMonths; i++) {
    const interestComponent = +(balance * r).toFixed(2);
    let principalComponent = +(emi - interestComponent).toFixed(2);

    // Adjust the final installment so the balance closes exactly at 0
    if (i === tenureMonths) {
      principalComponent = +balance.toFixed(2);
    }

    balance = +(balance - principalComponent).toFixed(2);
    if (balance < 0) balance = 0;

    const dueDate = new Date(start);
    dueDate.setMonth(dueDate.getMonth() + i);

    schedule.push({
      emi_number: i,
      due_date: dueDate.toISOString().slice(0, 10),
      emi_amount: i === tenureMonths ? +(principalComponent + interestComponent).toFixed(2) : emi,
      principal_component: principalComponent,
      interest_component: interestComponent,
      balance
    });
  }

  return { emi, schedule };
}

module.exports = { calculateEMI, generateSchedule };
