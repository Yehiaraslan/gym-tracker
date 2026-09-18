// "✦ AI hint" strip under a question. Supports **bold** spans.
import React from 'react';
import { Text, View } from 'react-native';
import { useI18n } from '@/lib/i18n';

type Props = { text: string; color: string; bold: string; bg: string };

export function HintBanner({ text, color, bold, bg }: Props) {
  const { isRTL } = useI18n();
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: bg,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
        alignSelf: 'stretch',
      }}
    >
      <Text style={{ color: bold, fontSize: 14 }}>✦</Text>
      <Text
        style={{
          flex: 1,
          color,
          fontSize: 13,
          lineHeight: 19,
          textAlign: isRTL ? 'right' : 'left',
          writingDirection: isRTL ? 'rtl' : 'ltr',
        }}
      >
        {parts.map((p, i) =>
          p.startsWith('**') ? (
            <Text key={i} style={{ fontWeight: '700', color: bold }}>
              {p.slice(2, -2)}
            </Text>
          ) : (
            <Text key={i}>{p}</Text>
          ),
        )}
      </Text>
    </View>
  );
}
