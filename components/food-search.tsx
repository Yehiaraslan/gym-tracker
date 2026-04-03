// ============================================================
// FOOD SEARCH — UAE food database search with serving sizes
// ============================================================

import { useState, useMemo, useRef, useEffect } from 'react';
import { Text, View, TouchableOpacity, TextInput, ScrollView, FlatList, Platform } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';
import * as Haptics from 'expo-haptics';
import foodDb from '@/data/uaeFoodDatabase.json';

interface FoodItem {
  id: string;
  name: string;
  category: string;
  per100g: { protein: number; carbs: number; fat: number; calories: number };
  servingSizes: { label: string; grams: number }[];
}

export interface FoodSearchResult {
  name: string;
  protein: number;
  carbs: number;
  fat: number;
  calories: number;
  servingLabel: string;
  grams: number;
}

interface FoodSearchProps {
  onAdd: (food: FoodSearchResult) => void;
  onClose: () => void;
  mealNumber?: number;
}

const QUICK_ADD_IDS = [
  'uae043', 'uae045', 'uae053', 'uae058', 'uae062',
  'uae063', 'uae047', 'uae067', 'uae050', 'uae073',
];

const CATEGORIES = [
  'All', 'Protein Foods', 'UAE Street Food', 'UAE Traditional', 'Arabic Breakfast',
  'Fast Food', 'Restaurant', 'Carbohydrates', 'Fruits', 'Vegetables', 'Dairy',
  'Nuts & Seeds', 'Fats & Oils', 'Sauces & Condiments', 'Snacks', 'Beverages',
  'Supermarket', 'Supplements',
];

function calcMacros(item: FoodItem, grams: number) {
  const ratio = grams / 100;
  return {
    protein: Math.round(item.per100g.protein * ratio * 10) / 10,
    carbs: Math.round(item.per100g.carbs * ratio * 10) / 10,
    fat: Math.round(item.per100g.fat * ratio * 10) / 10,
    calories: Math.round(item.per100g.calories * ratio),
  };
}

function fuzzyMatch(query: string, text: string): boolean {
  const q = query.toLowerCase().trim();
  const t = text.toLowerCase();
  if (t.includes(q)) return true;
  return q.split(/\s+/).every(w => t.includes(w));
}

export function FoodSearch({ onAdd, onClose, mealNumber }: FoodSearchProps) {
  const colors = useColors();
  const inputRef = useRef<TextInput>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [selectedServing, setSelectedServing] = useState(0);
  const [customGrams, setCustomGrams] = useState('');
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualProtein, setManualProtein] = useState('');
  const [manualCarbs, setManualCarbs] = useState('');
  const [manualFat, setManualFat] = useState('');
  const [manualGrams, setManualGrams] = useState('100');

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 300);
  }, []);

  const quickAddItems = useMemo(() =>
    QUICK_ADD_IDS.map(id => (foodDb as FoodItem[]).find(f => f.id === id)).filter(Boolean) as FoodItem[],
  []);

  const filtered = useMemo(() => {
    const db = foodDb as FoodItem[];
    if (!query && category === 'All') return db.slice(0, 30);
    return db.filter(item => {
      const matchCat = category === 'All' || item.category === category;
      const matchQ = !query || fuzzyMatch(query, item.name) || fuzzyMatch(query, item.category);
      return matchCat && matchQ;
    }).slice(0, 50);
  }, [query, category]);

  const effectiveGrams = selectedFood
    ? customGrams
      ? parseFloat(customGrams) || 0
      : selectedFood.servingSizes[selectedServing]?.grams ?? 100
    : 0;

  const preview = selectedFood ? calcMacros(selectedFood, effectiveGrams) : null;

  function handleAdd() {
    if (!selectedFood || effectiveGrams <= 0) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const macros = calcMacros(selectedFood, effectiveGrams);
    const servingLabel = customGrams
      ? `${customGrams}g`
      : selectedFood.servingSizes[selectedServing]?.label ?? `${effectiveGrams}g`;
    onAdd({ name: selectedFood.name, ...macros, servingLabel, grams: effectiveGrams });
  }

  function handleQuickAdd(food: FoodItem) {

    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const macros = calcMacros(food, food.servingSizes[0].grams);
    onAdd({
      name: food.name,
      ...macros,
      servingLabel: food.servingSizes[0].label,
      grams: food.servingSizes[0].grams,
    });
  }
  function handleManualAdd() {
    if (!manualName.trim()) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const p = parseFloat(manualProtein) || 0;
    const c = parseFloat(manualCarbs) || 0;
    const f = parseFloat(manualFat) || 0;
    const cal = Math.round(p * 4 + c * 4 + f * 9);
    const g = parseFloat(manualGrams) || 100;
    onAdd({ name: manualName.trim(), protein: p, carbs: c, fat: f, calories: cal, servingLabel: g + 'g', grams: g });
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3" style={{ borderBottomWidth: 1, borderBottomColor: colors.cardBorder }}>
        <View className="flex-1 flex-row items-center rounded-xl px-3 py-2.5" style={{ backgroundColor: colors.surface }}>
          <IconSymbol name="magnifyingglass" size={16} color={colors.cardMuted} />
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            placeholder="Search 280+ UAE foods..."
            placeholderTextColor={colors.cardMuted}
            className="flex-1 ml-2 text-sm text-cardForeground"
            returnKeyType="search"
          />
          {query !== '' && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <IconSymbol name="xmark.circle.fill" size={16} color={colors.cardMuted} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity onPress={onClose} className="ml-3">
          <Text className="text-sm font-medium" style={{ color: colors.primary }}>Cancel</Text>
        </TouchableOpacity>
      </View>

      {/* Category filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="py-2 px-4"
        style={{ borderBottomWidth: 1, borderBottomColor: colors.cardBorder, maxHeight: 68 }}
      >
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat}
            onPress={() => setCategory(cat)}
            className="mr-2 px-4 py-2.5 rounded-full"
            style={{
              backgroundColor: category === cat ? colors.primary : colors.surface,
            }}
          >
            <Text
              className="text-xs font-medium"
              style={{ color: category === cat ? '#FFFFFF' : colors.cardMuted }}
            >
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
        {/* Quick Add */}
        {!query && !selectedFood && category === 'All' && (
          <View className="px-4 pt-4 pb-2">
            <Text className="text-xs font-medium text-cardMuted mb-3" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
              Quick Add
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {quickAddItems.map(food => {
                const macros = calcMacros(food, food.servingSizes[0].grams);
                return (
                  <TouchableOpacity
                    key={food.id}
                    onPress={() => handleQuickAdd(food)}
                    className="mr-2 rounded-xl p-3"
                    style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.cardBorder, width: 130 }}
                  >
                    <Text className="text-xs font-medium text-cardForeground" numberOfLines={2}>{food.name}</Text>
                    <Text className="text-xs text-cardMuted mt-0.5">{food.servingSizes[0].label}</Text>
                    <Text className="text-xs font-semibold mt-1" style={{ color: colors.primary }}>{macros.calories} kcal</Text>
                    <Text className="text-xs text-cardMuted">P:{macros.protein}g</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Selected food detail */}
        {selectedFood && (
          <View className="px-4 pt-4">
            <View className="rounded-2xl p-4" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.cardBorder }}>
              <View className="flex-row items-start justify-between mb-3">
                <View className="flex-1">
                  <Text className="text-base font-semibold text-cardForeground">{selectedFood.name}</Text>
                  <Text className="text-xs text-cardMuted mt-0.5">{selectedFood.category}</Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedFood(null)}>
                  <IconSymbol name="xmark.circle.fill" size={20} color={colors.cardMuted} />
                </TouchableOpacity>
              </View>

              {/* Serving sizes */}
              <Text className="text-xs text-cardMuted mb-2">Serving size</Text>
              <View className="flex-row flex-wrap" style={{ gap: 6 }}>
                {selectedFood.servingSizes.map((s, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => { setSelectedServing(i); setCustomGrams(''); }}
                    className="px-3 py-1.5 rounded-lg"
                    style={{
                      backgroundColor: selectedServing === i && !customGrams ? colors.primary : colors.background,
                      borderWidth: 1,
                      borderColor: selectedServing === i && !customGrams ? colors.primary : colors.cardBorder,
                    }}
                  >
                    <Text
                      className="text-xs font-medium"
                      style={{ color: selectedServing === i && !customGrams ? '#FFFFFF' : colors.cardMuted }}
                    >
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                ))}
                <View className="flex-row items-center rounded-lg px-2" style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.cardBorder }}>
                  <TextInput
                    value={customGrams}
                    onChangeText={setCustomGrams}
                    placeholder="Custom"
                    placeholderTextColor={colors.cardMuted}
                    keyboardType="decimal-pad"
                    className="text-xs py-1.5 text-cardForeground"
                    style={{ width: 60 }}
                  />
                  <Text className="text-xs text-cardMuted">g</Text>
                </View>
              </View>

              {/* Macro preview */}
              {preview && effectiveGrams > 0 && (
                <View className="flex-row mt-4" style={{ gap: 8 }}>
                  {[
                    { label: 'Cal', value: preview.calories, unit: '', color: colors.cardForeground },
                    { label: 'Protein', value: preview.protein, unit: 'g', color: '#3B82F6' },
                    { label: 'Carbs', value: preview.carbs, unit: 'g', color: '#F59E0B' },
                    { label: 'Fat', value: preview.fat, unit: 'g', color: '#8B5CF6' },
                  ].map(m => (
                    <View key={m.label} className="flex-1 rounded-xl p-2 items-center" style={{ backgroundColor: colors.background }}>
                      <Text className="text-base font-bold" style={{ color: m.color }}>{m.value}{m.unit}</Text>
                      <Text className="text-xs text-cardMuted">{m.label}</Text>
                    </View>
                  ))}
                </View>
              )}

              <TouchableOpacity
                onPress={handleAdd}
                disabled={effectiveGrams <= 0}
                className="mt-4 py-3 rounded-xl flex-row items-center justify-center"
                style={{ backgroundColor: effectiveGrams > 0 ? colors.primary : colors.cardBorder }}
              >
                <IconSymbol name="plus.circle.fill" size={18} color="#FFFFFF" />
                <Text className="text-white font-semibold ml-2">Add to Log</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Search results */}
        {!selectedFood && (
          <View className="px-4 pt-2 pb-6">
            {query !== '' && (
              <Text className="text-xs text-cardMuted mb-3">{filtered.length} results</Text>
            )}
            {filtered.length === 0 ? (
              <View className="items-center py-12">
                <Text className="text-sm text-cardMuted">No foods found for "{query}"</Text>
              </View>
            ) : (
              filtered.map(food => {
                const macros = calcMacros(food, food.servingSizes[0].grams);
                return (
                  <TouchableOpacity
                    key={food.id}
                    onPress={() => { setSelectedFood(food); setSelectedServing(0); setCustomGrams(''); }}
                    className="flex-row items-center justify-between rounded-xl p-3 mb-2"
                    style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.cardBorder }}
                  >
                    <View className="flex-1 mr-3">
                      <Text className="text-sm font-medium text-cardForeground" numberOfLines={1}>{food.name}</Text>
                      <Text className="text-xs text-cardMuted mt-0.5">{food.servingSizes[0].label} · {food.category}</Text>
                    </View>
                    <View className="items-end">
                      <Text className="text-sm font-semibold text-cardForeground">{macros.calories}</Text>
                      <Text className="text-xs text-cardMuted">kcal</Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}
        {/* Manual Entry */}
        {!selectedFood && (
          <View className="px-4 pb-6">
            <TouchableOpacity
              onPress={() => setShowManualEntry(!showManualEntry)}
              className="flex-row items-center justify-center py-3 rounded-xl mb-3"
              style={{ borderWidth: 1, borderColor: colors.cardBorder, borderStyle: "dashed" }}
            >
              <IconSymbol name="plus.circle" size={16} color={colors.primary} />
              <Text className="text-sm font-medium ml-2" style={{ color: colors.primary }}>
                {showManualEntry ? "Hide Manual Entry" : "Can't find it? Add manually"}
              </Text>
            </TouchableOpacity>
            {showManualEntry && (
              <View className="rounded-2xl p-4" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.cardBorder }}>
                <TextInput value={manualName} onChangeText={setManualName} placeholder="Food name" placeholderTextColor={colors.cardMuted} className="h-12 px-4 rounded-xl text-cardForeground mb-3" style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.cardBorder }} />
                <View className="flex-row mb-3" style={{ gap: 8 }}>
                  <View className="flex-1"><Text className="text-xs text-cardMuted mb-1">Protein (g)</Text><TextInput value={manualProtein} onChangeText={setManualProtein} placeholder="0" placeholderTextColor={colors.cardMuted} keyboardType="decimal-pad" className="h-10 px-3 rounded-xl text-center text-cardForeground" style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: "#3B82F640" }} /></View>
                  <View className="flex-1"><Text className="text-xs text-cardMuted mb-1">Carbs (g)</Text><TextInput value={manualCarbs} onChangeText={setManualCarbs} placeholder="0" placeholderTextColor={colors.cardMuted} keyboardType="decimal-pad" className="h-10 px-3 rounded-xl text-center text-cardForeground" style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: "#F59E0B40" }} /></View>
                  <View className="flex-1"><Text className="text-xs text-cardMuted mb-1">Fat (g)</Text><TextInput value={manualFat} onChangeText={setManualFat} placeholder="0" placeholderTextColor={colors.cardMuted} keyboardType="decimal-pad" className="h-10 px-3 rounded-xl text-center text-cardForeground" style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: "#EF444440" }} /></View>
                </View>
                <View className="flex-row items-center mb-3" style={{ gap: 8 }}>
                  <View className="flex-1"><Text className="text-xs text-cardMuted mb-1">Serving (g)</Text><TextInput value={manualGrams} onChangeText={setManualGrams} placeholder="100" placeholderTextColor={colors.cardMuted} keyboardType="decimal-pad" className="h-10 px-3 rounded-xl text-center text-cardForeground" style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.cardBorder }} /></View>
                  <View className="flex-1 rounded-xl p-2 items-center" style={{ backgroundColor: colors.background }}>
                    <Text className="text-lg font-bold text-cardForeground">{Math.round((parseFloat(manualProtein)||0)*4 + (parseFloat(manualCarbs)||0)*4 + (parseFloat(manualFat)||0)*9)}</Text>
                    <Text className="text-xs text-cardMuted">kcal</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={handleManualAdd} disabled={!manualName.trim()} className="py-3 rounded-xl flex-row items-center justify-center" style={{ backgroundColor: manualName.trim() ? colors.primary : colors.cardBorder }}>
                  <IconSymbol name="plus.circle.fill" size={18} color="#FFFFFF" />
                  <Text className="text-white font-semibold ml-2">Add to Log</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
