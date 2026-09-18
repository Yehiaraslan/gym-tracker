// Small form primitives shared by the plan and meal builders.
import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View, type TextInputProps } from 'react-native';
import { useColors } from '@/hooks/use-colors';

export function Field({ label, value, onChangeText, multiline, ...rest }: { label: string; value: string; onChangeText: (v: string) => void; multiline?: boolean } & TextInputProps) {
  const c = useColors();
  return (
    <View style={{ gap: 4 }}>
      <Text style={[f.label, { color: c.muted }]}>{label}</Text>
      <TextInput
        style={[f.input, { color: c.foreground, borderColor: c.border, backgroundColor: c.surface2 }, multiline && { minHeight: 70, textAlignVertical: 'top' }]}
        placeholderTextColor={c.muted}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        {...rest}
      />
    </View>
  );
}

export function NumField({ label, value, onChange, width = 72, suffix }: { label: string; value: number; onChange: (v: number) => void; width?: number; suffix?: string }) {
  const c = useColors();
  const [text, setText] = React.useState(String(value));
  React.useEffect(() => { setText(String(value)); }, [value]);
  return (
    <View style={{ gap: 4, width }}>
      <Text style={[f.label, { color: c.muted }]} numberOfLines={1}>{label}{suffix ? ` (${suffix})` : ''}</Text>
      <TextInput
        style={[f.input, f.num, { color: c.foreground, borderColor: c.border, backgroundColor: c.surface2 }]}
        keyboardType="numeric"
        value={text}
        onChangeText={(v) => { setText(v); const n = Number(v); if (v !== '' && Number.isFinite(n)) onChange(n); }}
        onBlur={() => { const n = Number(text); if (!Number.isFinite(n) || text === '') setText(String(value)); }}
        selectTextOnFocus
      />
    </View>
  );
}

export function Btn({ label, onPress, kind = 'primary', disabled, small }: { label: string; onPress: () => void; kind?: 'primary' | 'ghost' | 'danger'; disabled?: boolean; small?: boolean }) {
  const c = useColors();
  const bg = kind === 'primary' ? c.primary : 'transparent';
  const fg = kind === 'primary' ? c.primaryInk : kind === 'danger' ? c.error : c.primary;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      style={[f.btn, small && f.btnSmall, { backgroundColor: bg, borderColor: kind === 'primary' ? bg : c.border, opacity: disabled ? 0.5 : 1 }]}
    >
      <Text style={[f.btnText, small && { fontSize: 13 }, { color: fg }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const c = useColors();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[f.chip, { backgroundColor: active ? c.primarySoft : c.surface2, borderColor: active ? c.primary : c.border }]}
    >
      <Text style={[f.chipText, { color: active ? c.primary : c.muted }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const f = StyleSheet.create({
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  input: { minHeight: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  num: { textAlign: 'center', paddingHorizontal: 6 },
  btn: { height: 48, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  btnSmall: { height: 36, borderRadius: 10, paddingHorizontal: 12 },
  btnText: { fontSize: 15, fontWeight: '700' },
  chip: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { fontSize: 13, fontWeight: '700' },
});
