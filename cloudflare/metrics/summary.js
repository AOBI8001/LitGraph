const shift = (day, offset) => new Date(Date.parse(day + 'T00:00:00Z') + offset * 86400000).toISOString().slice(0, 10);

// Aggregate existing anonymous events only. A use denotes an action, not success.
export async function usageSummary(db, today) {
  const weekStart = shift(today, -6), monthStart = shift(today, -29);
  const activity = await db.prepare(`SELECT
    COUNT(DISTINCT CASE WHEN day=? THEN install_hash END) AS dau,
    COUNT(DISTINCT CASE WHEN day>=? THEN install_hash END) AS wau,
    COUNT(DISTINCT install_hash) AS mau,
    COALESCE(SUM(CASE WHEN day=? THEN uses ELSE 0 END),0) AS actionsToday
    FROM daily_activity WHERE day>=? AND day<=? AND uses>0`)
    .bind(today, weekStart, today, monthStart, today).first();
  const activation = await db.prepare(`SELECT COUNT(*) AS newInstalls30,
    COALESCE(SUM(CASE WHEN d.uses>0 THEN 1 ELSE 0 END),0) AS activated30
    FROM installations i LEFT JOIN daily_activity d ON d.install_hash=i.install_hash AND d.day=i.first_day
    WHERE i.first_day>=? AND i.first_day<=?`).bind(monthStart, today).first();
  const returning = await db.prepare(`SELECT COUNT(*) AS returningToday FROM daily_activity d
    JOIN installations i ON i.install_hash=d.install_hash
    WHERE d.day=? AND d.uses>0 AND i.first_day<?`).bind(today, today).first();
  return { today, weekStart, monthStart, ...activity, ...activation, ...returning,
    activationRate30: activation.newInstalls30 ? activation.activated30 / activation.newInstalls30 : null,
    dauMauRatio: activity.mau ? activity.dau / activity.mau : null,
    actionsPerActive: activity.dau ? activity.actionsToday / activity.dau : null };
}
