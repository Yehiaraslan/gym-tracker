#!/usr/bin/env python3
"""Expand UAE food database with more items."""
import json

with open('data/uaeFoodDatabase.json') as f:
    data = json.load(f)

max_id = max(int(item['id'].replace('uae','')) for item in data)

new_foods = [
    # Beverages - UAE essentials
    {"name":"Karak Chai","category":"Beverages","per100g":{"protein":1,"carbs":12,"fat":3,"calories":79},"servingSizes":[{"label":"1 cup (~150ml)","grams":150},{"label":"Large cup (~250ml)","grams":250}]},
    {"name":"Karak Chai (no sugar)","category":"Beverages","per100g":{"protein":1,"carbs":3,"fat":3,"calories":43},"servingSizes":[{"label":"1 cup (~150ml)","grams":150},{"label":"Large cup (~250ml)","grams":250}]},
    {"name":"Arabic Coffee (Gahwa)","category":"Beverages","per100g":{"protein":0,"carbs":0,"fat":0,"calories":2},"servingSizes":[{"label":"1 cup (~80ml)","grams":80},{"label":"3 cups","grams":240}]},
    {"name":"Turkish Coffee","category":"Beverages","per100g":{"protein":0,"carbs":1,"fat":0,"calories":5},"servingSizes":[{"label":"1 cup (~60ml)","grams":60}]},
    {"name":"Vimto (Ramadan)","category":"Beverages","per100g":{"protein":0,"carbs":13,"fat":0,"calories":52},"servingSizes":[{"label":"1 glass (~200ml)","grams":200}]},
    {"name":"Jallab","category":"Beverages","per100g":{"protein":0,"carbs":18,"fat":0,"calories":72},"servingSizes":[{"label":"1 glass (~250ml)","grams":250}]},
    {"name":"Qamar al-Din","category":"Beverages","per100g":{"protein":0,"carbs":15,"fat":0,"calories":60},"servingSizes":[{"label":"1 glass (~200ml)","grams":200}]},
    {"name":"Lemon Mint Juice","category":"Beverages","per100g":{"protein":0,"carbs":10,"fat":0,"calories":40},"servingSizes":[{"label":"1 glass (~250ml)","grams":250}]},
    {"name":"Date Shake (milk + dates)","category":"Beverages","per100g":{"protein":3,"carbs":18,"fat":2,"calories":102},"servingSizes":[{"label":"1 glass (~300ml)","grams":300}]},
    {"name":"Tim Hortons Double Double","category":"Beverages","per100g":{"protein":2,"carbs":6,"fat":3,"calories":59},"servingSizes":[{"label":"Medium (~300ml)","grams":300},{"label":"Large (~400ml)","grams":400}]},
    {"name":"Al Ain Water","category":"Beverages","per100g":{"protein":0,"carbs":0,"fat":0,"calories":0},"servingSizes":[{"label":"500ml","grams":500},{"label":"1.5L","grams":1500}]},
    
    # UAE Street Food
    {"name":"Chicken Shawarma Plate (with rice)","category":"UAE Street Food","per100g":{"protein":10,"carbs":18,"fat":6,"calories":166},"servingSizes":[{"label":"Full plate (~450g)","grams":450},{"label":"Half plate","grams":225}]},
    {"name":"Lamb Shawarma Plate (with rice)","category":"UAE Street Food","per100g":{"protein":9,"carbs":18,"fat":8,"calories":180},"servingSizes":[{"label":"Full plate (~450g)","grams":450},{"label":"Half plate","grams":225}]},
    {"name":"Shawarma (garlic sauce)","category":"UAE Street Food","per100g":{"protein":12,"carbs":24,"fat":12,"calories":252},"servingSizes":[{"label":"1 wrap (~300g)","grams":300}]},
    {"name":"Fattoush Salad","category":"UAE Street Food","per100g":{"protein":2,"carbs":8,"fat":5,"calories":85},"servingSizes":[{"label":"1 bowl (~200g)","grams":200},{"label":"Side (~120g)","grams":120}]},
    {"name":"Mutabal (baba ganoush)","category":"UAE Street Food","per100g":{"protein":3,"carbs":7,"fat":8,"calories":112},"servingSizes":[{"label":"2 tbsp (~30g)","grams":30},{"label":"Small bowl (~100g)","grams":100}]},
    {"name":"Kunafa (cheese)","category":"UAE Street Food","per100g":{"protein":7,"carbs":40,"fat":18,"calories":350},"servingSizes":[{"label":"1 piece (~120g)","grams":120},{"label":"Small piece (~80g)","grams":80}]},
    
    # UAE Traditional
    {"name":"Balaleet (sweet vermicelli + egg)","category":"UAE Traditional","per100g":{"protein":6,"carbs":35,"fat":8,"calories":236},"servingSizes":[{"label":"1 serving (~200g)","grams":200}]},
    {"name":"Thareed (lamb stew + bread)","category":"UAE Traditional","per100g":{"protein":8,"carbs":15,"fat":6,"calories":146},"servingSizes":[{"label":"1 bowl (~350g)","grams":350}]},
    {"name":"Khameer Bread","category":"UAE Traditional","per100g":{"protein":8,"carbs":48,"fat":5,"calories":269},"servingSizes":[{"label":"1 piece (~80g)","grams":80}]},
    {"name":"Chebab (Emirati pancake)","category":"UAE Traditional","per100g":{"protein":5,"carbs":38,"fat":6,"calories":226},"servingSizes":[{"label":"1 piece (~60g)","grams":60},{"label":"3 pieces","grams":180}]},
    {"name":"Madrooba (spiced porridge)","category":"UAE Traditional","per100g":{"protein":5,"carbs":12,"fat":4,"calories":104},"servingSizes":[{"label":"1 bowl (~250g)","grams":250}]},
    {"name":"Jasheed (shark dish)","category":"UAE Traditional","per100g":{"protein":14,"carbs":12,"fat":5,"calories":149},"servingSizes":[{"label":"1 serving (~200g)","grams":200}]},
    {"name":"Saloona (veg stew)","category":"UAE Traditional","per100g":{"protein":4,"carbs":8,"fat":3,"calories":75},"servingSizes":[{"label":"1 bowl (~300g)","grams":300}]},
    {"name":"Margoogat (lamb & veg)","category":"UAE Traditional","per100g":{"protein":6,"carbs":10,"fat":4,"calories":100},"servingSizes":[{"label":"1 bowl (~350g)","grams":350}]},
    {"name":"Dates (Khlas)","category":"UAE Traditional","per100g":{"protein":2,"carbs":73,"fat":0,"calories":282},"servingSizes":[{"label":"1 date (~10g)","grams":10},{"label":"3 dates","grams":30},{"label":"5 dates","grams":50}]},
    {"name":"Dates (Barhi, fresh)","category":"UAE Traditional","per100g":{"protein":1,"carbs":65,"fat":0,"calories":260},"servingSizes":[{"label":"3 dates (~30g)","grams":30},{"label":"5 dates","grams":50}]},
    {"name":"Dates with Tahini","category":"UAE Traditional","per100g":{"protein":5,"carbs":55,"fat":12,"calories":344},"servingSizes":[{"label":"3 dates + 1 tbsp (~45g)","grams":45}]},
    
    # Arabic Breakfast
    {"name":"Halloumi (grilled)","category":"Arabic Breakfast","per100g":{"protein":22,"carbs":2,"fat":25,"calories":321},"servingSizes":[{"label":"2 slices (~60g)","grams":60},{"label":"4 slices (~120g)","grams":120}]},
    {"name":"Akkawi Cheese","category":"Arabic Breakfast","per100g":{"protein":18,"carbs":1,"fat":22,"calories":274},"servingSizes":[{"label":"2 slices (~50g)","grams":50},{"label":"100g","grams":100}]},
    {"name":"Zaatar Mix (dry)","category":"Arabic Breakfast","per100g":{"protein":9,"carbs":20,"fat":30,"calories":390},"servingSizes":[{"label":"1 tbsp (~10g)","grams":10}]},
    {"name":"Foul with Olive Oil","category":"Arabic Breakfast","per100g":{"protein":8,"carbs":15,"fat":5,"calories":137},"servingSizes":[{"label":"1 bowl (~200g)","grams":200}]},
    {"name":"Balila (chickpea)","category":"Arabic Breakfast","per100g":{"protein":6,"carbs":18,"fat":3,"calories":123},"servingSizes":[{"label":"1 bowl (~200g)","grams":200}]},
    {"name":"Jibneh Bayda (white cheese)","category":"Arabic Breakfast","per100g":{"protein":15,"carbs":2,"fat":20,"calories":248},"servingSizes":[{"label":"2 slices (~50g)","grams":50}]},
    
    # Fast Food - UAE chains
    {"name":"Al Baik Chicken (1 piece)","category":"Fast Food","per100g":{"protein":18,"carbs":12,"fat":14,"calories":246},"servingSizes":[{"label":"1 piece (~130g)","grams":130},{"label":"2 pieces","grams":260},{"label":"4 pieces","grams":520}]},
    {"name":"Al Baik Garlic Sauce","category":"Fast Food","per100g":{"protein":1,"carbs":4,"fat":38,"calories":362},"servingSizes":[{"label":"1 packet (~25g)","grams":25}]},
    {"name":"Shake Shack ShackBurger","category":"Fast Food","per100g":{"protein":14,"carbs":11,"fat":17,"calories":253},"servingSizes":[{"label":"Single (~200g)","grams":200},{"label":"Double (~300g)","grams":300}]},
    {"name":"Five Guys Cheeseburger","category":"Fast Food","per100g":{"protein":14,"carbs":10,"fat":20,"calories":276},"servingSizes":[{"label":"Little (~250g)","grams":250},{"label":"Regular (~350g)","grams":350}]},
    {"name":"Five Guys Cajun Fries","category":"Fast Food","per100g":{"protein":3,"carbs":28,"fat":15,"calories":259},"servingSizes":[{"label":"Little (~230g)","grams":230},{"label":"Regular (~400g)","grams":400}]},
    {"name":"Nandos 1/4 Chicken","category":"Fast Food","per100g":{"protein":25,"carbs":0,"fat":8,"calories":172},"servingSizes":[{"label":"Quarter (~200g)","grams":200},{"label":"Half (~400g)","grams":400}]},
    {"name":"Pizza Hut Margherita (1 slice)","category":"Fast Food","per100g":{"protein":10,"carbs":25,"fat":10,"calories":230},"servingSizes":[{"label":"1 slice (~110g)","grams":110},{"label":"2 slices","grams":220}]},
    {"name":"Subway 6-inch Turkey","category":"Fast Food","per100g":{"protein":11,"carbs":18,"fat":3,"calories":143},"servingSizes":[{"label":"6-inch (~230g)","grams":230},{"label":"Footlong (~460g)","grams":460}]},
    {"name":"Subway Chicken Teriyaki","category":"Fast Food","per100g":{"protein":12,"carbs":20,"fat":4,"calories":164},"servingSizes":[{"label":"6-inch (~250g)","grams":250},{"label":"Footlong (~500g)","grams":500}]},
    {"name":"Hardees Angus Thickburger","category":"Fast Food","per100g":{"protein":14,"carbs":13,"fat":18,"calories":268},"servingSizes":[{"label":"1 burger (~310g)","grams":310}]},
    
    # Protein additions
    {"name":"Chicken Thigh (grilled, skin on)","category":"Protein Foods","per100g":{"protein":24,"carbs":0,"fat":10,"calories":190},"servingSizes":[{"label":"1 thigh (~120g)","grams":120},{"label":"2 thighs","grams":240}]},
    {"name":"Lamb Chops (grilled)","category":"Protein Foods","per100g":{"protein":25,"carbs":0,"fat":14,"calories":226},"servingSizes":[{"label":"2 chops (~150g)","grams":150},{"label":"4 chops","grams":300}]},
    {"name":"Kofta (beef, grilled)","category":"Protein Foods","per100g":{"protein":18,"carbs":3,"fat":15,"calories":219},"servingSizes":[{"label":"2 skewers (~120g)","grams":120},{"label":"4 skewers","grams":240}]},
    {"name":"Hammour (grilled)","category":"Protein Foods","per100g":{"protein":22,"carbs":0,"fat":2,"calories":106},"servingSizes":[{"label":"1 fillet (~180g)","grams":180}]},
    {"name":"Shrimp (grilled)","category":"Protein Foods","per100g":{"protein":24,"carbs":0,"fat":1,"calories":105},"servingSizes":[{"label":"10 pieces (~100g)","grams":100},{"label":"20 pieces","grams":200}]},
    {"name":"Camel Meat (grilled)","category":"Protein Foods","per100g":{"protein":22,"carbs":0,"fat":4,"calories":124},"servingSizes":[{"label":"1 serving (~150g)","grams":150}]},
    {"name":"Cottage Cheese (low fat)","category":"Protein Foods","per100g":{"protein":11,"carbs":3,"fat":4,"calories":92},"servingSizes":[{"label":"1 cup (~225g)","grams":225}]},
    {"name":"Turkey Breast (deli)","category":"Protein Foods","per100g":{"protein":19,"carbs":2,"fat":1,"calories":93},"servingSizes":[{"label":"3 slices (~60g)","grams":60},{"label":"6 slices","grams":120}]},
    
    # Carbs
    {"name":"Arabic Pita Bread","category":"Carbohydrates","per100g":{"protein":9,"carbs":55,"fat":1,"calories":265},"servingSizes":[{"label":"1 pita (~60g)","grams":60},{"label":"2 pitas","grams":120}]},
    {"name":"Samoon Bread","category":"Carbohydrates","per100g":{"protein":8,"carbs":50,"fat":2,"calories":250},"servingSizes":[{"label":"1 piece (~80g)","grams":80}]},
    {"name":"Tannour Bread","category":"Carbohydrates","per100g":{"protein":8,"carbs":52,"fat":1,"calories":249},"servingSizes":[{"label":"1 piece (~100g)","grams":100}]},
    {"name":"Jasmine Rice (cooked)","category":"Carbohydrates","per100g":{"protein":3,"carbs":28,"fat":0,"calories":130},"servingSizes":[{"label":"1 cup (~185g)","grams":185}]},
    {"name":"Freekeh (cooked)","category":"Carbohydrates","per100g":{"protein":5,"carbs":25,"fat":1,"calories":130},"servingSizes":[{"label":"1 cup (~200g)","grams":200}]},
    {"name":"Bulgur (cooked)","category":"Carbohydrates","per100g":{"protein":3,"carbs":19,"fat":0,"calories":83},"servingSizes":[{"label":"1 cup (~180g)","grams":180}]},
    
    # Dairy - UAE brands
    {"name":"Al Rawabi Full Fat Milk","category":"Dairy","per100g":{"protein":3,"carbs":5,"fat":3,"calories":61},"servingSizes":[{"label":"1 glass (~250ml)","grams":250}]},
    {"name":"Al Marai Laban","category":"Dairy","per100g":{"protein":3,"carbs":4,"fat":2,"calories":46},"servingSizes":[{"label":"1 cup (~200ml)","grams":200},{"label":"1 bottle (~360ml)","grams":360}]},
    {"name":"Nada Greek Yogurt (protein)","category":"Dairy","per100g":{"protein":10,"carbs":4,"fat":0,"calories":56},"servingSizes":[{"label":"1 cup (~170g)","grams":170}]},
    
    # Restaurant
    {"name":"Chicken Mandi","category":"Restaurant","per100g":{"protein":11,"carbs":16,"fat":5,"calories":153},"servingSizes":[{"label":"Full plate (~500g)","grams":500},{"label":"Half plate","grams":250}]},
    {"name":"Lamb Mandi","category":"Restaurant","per100g":{"protein":10,"carbs":16,"fat":7,"calories":167},"servingSizes":[{"label":"Full plate (~500g)","grams":500},{"label":"Half plate","grams":250}]},
    {"name":"Chicken Kabsa","category":"Restaurant","per100g":{"protein":10,"carbs":17,"fat":5,"calories":153},"servingSizes":[{"label":"Full plate (~450g)","grams":450}]},
    {"name":"Mixed Grill Plate","category":"Restaurant","per100g":{"protein":20,"carbs":2,"fat":12,"calories":196},"servingSizes":[{"label":"Full plate (~350g)","grams":350}]},
    {"name":"Grilled Hammour Plate","category":"Restaurant","per100g":{"protein":16,"carbs":10,"fat":4,"calories":140},"servingSizes":[{"label":"Full plate (~400g)","grams":400}]},
    {"name":"Lamb Ouzi","category":"Restaurant","per100g":{"protein":12,"carbs":14,"fat":9,"calories":185},"servingSizes":[{"label":"1 serving (~300g)","grams":300}]},
    
    # Supermarket meal prep
    {"name":"Kcal Extra Protein Meal","category":"Supermarket","per100g":{"protein":15,"carbs":10,"fat":4,"calories":136},"servingSizes":[{"label":"1 meal (~350g)","grams":350}]},
    {"name":"Right Bite Protein Meal","category":"Supermarket","per100g":{"protein":14,"carbs":12,"fat":5,"calories":149},"servingSizes":[{"label":"1 meal (~380g)","grams":380}]},
    
    # Snacks
    {"name":"Al Ain Honey","category":"Snacks","per100g":{"protein":0,"carbs":82,"fat":0,"calories":328},"servingSizes":[{"label":"1 tbsp (~21g)","grams":21},{"label":"2 tbsp","grams":42}]},
]

for i, food in enumerate(new_foods):
    food['id'] = f'uae{max_id + i + 1:03d}'

data.extend(new_foods)
with open('data/uaeFoodDatabase.json', 'w') as f:
    json.dump(data, f, separators=(',', ':'))

print(f'Added {len(new_foods)} new foods. Total: {len(data)} items')
