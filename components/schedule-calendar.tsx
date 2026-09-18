// ============================================================
// SCHEDULE CALENDAR — week / month view of the training schedule.
// Lands on today, lets the athlete pick any day. Pure presentation:
// the parent supplies session lookup, colours and completion.
// Week starts on Sunday (matches lib/schedule-store).
// ============================================================
import { useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/use-colors';
import { localizeDigits, useI18n, type StringKey } from '@/lib/i18n';
import { FontSize, FontWeight, Radius, Space } from '@/lib/design-tokens';
import type { SessionType } from '@/lib/training-program';

export type CalendarMode = 'week' | 'month';

export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function fromDateStr(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

function startOfWeek(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

const MONTH_KEYS: StringKey[] = ['monthJan', 'monthFeb', 'monthMar', 'monthApr', 'monthMay', 'monthJun', 'monthJul', 'monthAug', 'monthSep', 'monthOct', 'monthNov', 'monthDec'];
// Sunday-first, matching Date#getDay()
const DAY_KEYS: StringKey[] = ['daySun', 'dayMon', 'dayTue', 'dayWed', 'dayThu', 'dayFri', 'daySat'];
const DAY_KEYS_SHORT: StringKey[] = ['daySunS', 'dayMonS', 'dayTueS', 'dayWedS', 'dayThuS', 'dayFriS', 'daySatS'];

export interface ScheduleCalendarProps {
  mode: CalendarMode;
  onModeChange: (m: CalendarMode) => void;
  selectedDate: string;
  onSelect: (dateStr: string) => void;
  todayStr: string;
  sessionForDate: (dateStr: string) => SessionType;
  colorFor: (session: SessionType) => string;
  completedDates: Set<string>;
}

export function ScheduleCalendar({
  mode, onModeChange, selectedDate, onSelect, todayStr, sessionForDate, colorFor, completedDates,
}: ScheduleCalendarProps) {
  const colors = useColors();
  const { t, lang, isRTL } = useI18n();
  // Cursor = any date inside the displayed week / month. Starts on the selected day.
  const [cursor, setCursor] = useState<Date>(() => fromDateStr(selectedDate));

  const haptic = () => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); };

  const shift = (dir: 1 | -1) => {
    haptic();
    setCursor((c) => {
      if (mode === 'week') return addDays(c, 7 * dir);
      return new Date(c.getFullYear(), c.getMonth() + dir, 1, 12);
    });
  };

  const goToday = () => {
    haptic();
    setCursor(fromDateStr(todayStr));
    onSelect(todayStr);
  };

  // ── Cells ──
  const weekCells = useMemo(() => {
    const start = startOfWeek(cursor);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [cursor]);

  const monthRows = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1, 12);
    const gridStart = startOfWeek(first);
    const monthIndex = (d: Date) => d.getFullYear() * 12 + d.getMonth();
    const rows: Date[][] = [];
    for (let r = 0; r < 6; r++) {
      const rowStart = addDays(gridStart, r * 7);
      // Stop once a row starts in the following month (the month is fully shown)
      if (r > 0 && monthIndex(rowStart) > monthIndex(first)) break;
      rows.push(Array.from({ length: 7 }, (_, i) => addDays(rowStart, i)));
    }
    return rows;
  }, [cursor]);

  const cursorHasToday = mode === 'week'
    ? weekCells.some((d) => toDateStr(d) === todayStr)
    : (cursor.getFullYear() === fromDateStr(todayStr).getFullYear() && cursor.getMonth() === fromDateStr(todayStr).getMonth());

  const title = mode === 'week'
    ? (() => {
        const a = weekCells[0];
        const b = weekCells[6];
        const sameMonth = a.getMonth() === b.getMonth();
        const da = localizeDigits(a.getDate(), lang);
        const db = localizeDigits(b.getDate(), lang);
        const ma = t(MONTH_KEYS[a.getMonth()]);
        const mb = t(MONTH_KEYS[b.getMonth()]);
        return sameMonth ? `${da}–${db} ${ma}` : `${da} ${ma} – ${db} ${mb}`;
      })()
    : `${t(MONTH_KEYS[cursor.getMonth()])} ${localizeDigits(cursor.getFullYear(), lang)}`;

  const rowDir = isRTL ? 'row-reverse' : 'row';
  const pri = colors.primary;
  const ink = colors.primaryInk;
  const fg = colors.cardForeground;
  const mut = colors.cardMuted;
  const bord = colors.cardBorder;

  const renderCell = (d: Date, compact: boolean, inMonth = true) => {
    const ds = toDateStr(d);
    const isToday = ds === todayStr;
    const isSelected = ds === selectedDate;
    const session = sessionForDate(ds);
    const isRest = session === 'rest';
    const done = completedDates.has(ds);
    const dot = isRest ? bord : colorFor(session);
    const size = compact ? 34 : 40;
    return (
      <TouchableOpacity
        key={ds}
        onPress={() => { haptic(); onSelect(ds); }}
        activeOpacity={0.7}
        style={[st.cell, compact && st.cellCompact, { opacity: inMonth ? 1 : 0.3 }]}
        accessibilityLabel={ds}
      >
        {!compact && (
          <Text style={[st.dayLabel, { color: isToday ? pri : mut, fontWeight: isToday ? '700' : '500' }]} numberOfLines={1}>
            {t(DAY_KEYS[d.getDay()]).slice(0, lang === 'ar' ? 8 : 3)}
          </Text>
        )}
        <View
          style={[
            st.numWrap,
            { width: size, height: size, borderRadius: size / 2 },
            isSelected && { backgroundColor: pri },
            !isSelected && isToday && { borderWidth: 2, borderColor: pri },
          ]}
        >
          <Text style={{ color: isSelected ? ink : fg, fontSize: compact ? 13 : 15, fontWeight: isToday || isSelected ? '800' : '600' }}>
            {localizeDigits(d.getDate(), lang)}
          </Text>
          {done && (
            <View style={[st.doneBadge, { backgroundColor: colors.successStrong, borderColor: colors.surface }]}>
              <Text style={{ color: '#fff', fontSize: 8, fontWeight: '900', lineHeight: 10 }}>✓</Text>
            </View>
          )}
        </View>
        <View style={[st.sessionDot, { backgroundColor: isSelected ? pri : dot, opacity: isRest ? 0.5 : 1, width: isRest ? 4 : 6, height: isRest ? 4 : 6 }]} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={[st.card, { backgroundColor: colors.surface, borderColor: bord }]}>
      {/* Header: title + mode toggle */}
      <View style={[st.headerRow, { flexDirection: rowDir }]}>
        <View style={{ flex: 1, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
          <Text style={[st.eyebrow, { color: mut, textAlign: isRTL ? 'right' : 'left' }]}>{t('homeSchedule').toUpperCase()}</Text>
          <Text style={[st.title, { color: fg, textAlign: isRTL ? 'right' : 'left' }]}>{title}</Text>
        </View>
        <View style={[st.segment, { backgroundColor: colors.surface2, borderColor: bord, flexDirection: rowDir }]}>
          {(['week', 'month'] as CalendarMode[]).map((m) => {
            const active = mode === m;
            return (
              <TouchableOpacity
                key={m}
                onPress={() => { haptic(); onModeChange(m); }}
                style={[st.segBtn, active && { backgroundColor: pri }]}
                activeOpacity={0.8}
                accessibilityLabel={`mode-${m}`}
              >
                <Text style={{ color: active ? ink : mut, fontSize: 12, fontWeight: '700' }}>
                  {t(m === 'week' ? 'homeWeek' : 'homeMonth')}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Nav: prev / today / next */}
      <View style={[st.navRow, { flexDirection: rowDir }]}>
        <TouchableOpacity onPress={() => shift(-1)} style={[st.navBtn, { borderColor: bord }]} accessibilityLabel="prev">
          <Text style={{ color: fg, fontSize: 16, fontWeight: '700' }}>{isRTL ? '›' : '‹'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={goToday}
          disabled={cursorHasToday && selectedDate === todayStr}
          style={[st.todayBtn, { borderColor: pri + '60', backgroundColor: pri + '14', opacity: cursorHasToday && selectedDate === todayStr ? 0.45 : 1 }]}
          accessibilityLabel="today"
        >
          <Text style={{ color: pri, fontSize: 12, fontWeight: '800' }}>{t('homeToday')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => shift(1)} style={[st.navBtn, { borderColor: bord }]} accessibilityLabel="next">
          <Text style={{ color: fg, fontSize: 16, fontWeight: '700' }}>{isRTL ? '‹' : '›'}</Text>
        </TouchableOpacity>
      </View>

      {mode === 'week' ? (
        <View style={[st.grid, { flexDirection: rowDir }]}>
          {weekCells.map((d) => renderCell(d, false))}
        </View>
      ) : (
        <View>
          <View style={[st.grid, { flexDirection: rowDir, marginBottom: 4 }]}>
            {DAY_KEYS_SHORT.map((k, i) => (
              <View key={k} style={st.cellCompact}>
                <Text style={{ color: i === 5 ? pri : mut, fontSize: 11, fontWeight: '700' }}>{t(k)}</Text>
              </View>
            ))}
          </View>
          {monthRows.map((row, ri) => (
            <View key={ri} style={[st.grid, { flexDirection: rowDir }]}>
              {row.map((d) => renderCell(d, true, d.getMonth() === cursor.getMonth()))}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  card: { borderRadius: Radius.hero, borderWidth: 1, padding: Space._4 },
  headerRow: { alignItems: 'center', justifyContent: 'space-between', marginBottom: Space._3 },
  eyebrow: { fontSize: FontSize.eyebrow, fontWeight: FontWeight.semi, letterSpacing: 1 },
  title: { fontSize: FontSize.section, fontWeight: FontWeight.heavy, marginTop: 2 },
  segment: { borderRadius: Radius.chip, borderWidth: 1, padding: 3 },
  segBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.chip },
  navRow: { alignItems: 'center', justifyContent: 'space-between', marginBottom: Space._3 },
  navBtn: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  todayBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.chip, borderWidth: 1 },
  grid: { justifyContent: 'space-between', alignItems: 'flex-start' },
  cell: { alignItems: 'center', width: `${100 / 7}%`, gap: 5, paddingVertical: 2 },
  cellCompact: { alignItems: 'center', width: `${100 / 7}%`, gap: 3, paddingVertical: 3 },
  dayLabel: { fontSize: 11 },
  numWrap: { alignItems: 'center', justifyContent: 'center', position: 'relative' },
  doneBadge: { position: 'absolute', top: -3, right: -3, width: 15, height: 15, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  sessionDot: { borderRadius: 3 },
});
