// ============================================================
// I18N — English / Arabic
// Language choice persists in AsyncStorage. RTL is handled per
// component (row direction + text alignment) rather than through
// I18nManager.forceRTL, which needs a native restart to take effect.
// ============================================================
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LANGUAGE_KEY = '@app_language';

export type Language = 'en' | 'ar';

// ── Strings ──────────────────────────────────────────────────

const en = {
  // Common
  continue: 'Continue',
  back: 'Back',
  finish: 'Finish',
  skip: 'Skip',
  settingUp: 'Setting up...',
  startNow: 'Start now',
  selectAll: 'Select all',
  saveFailedTitle: 'Save failed',
  saveFailedBody: 'Could not save your profile. Please try again.',
  appName: 'MY Lifestyle',

  // Language
  languageTitle: 'Choose your language',
  languageHint: 'You can change this later from your profile.',
  english: 'English',
  arabic: 'العربية',

  // Gender
  genderTitle: "What's your gender?",
  male: 'Male',
  female: 'Female',

  // Goal
  goalTitle: "What's your main goal?",
  goalHint: 'Coach Mohamad Yousry tailors your program, nutrition targets and coaching to match.',
  goal_muscle_gain: 'Build muscle',
  goal_fat_loss: 'Lose fat',
  goal_strength: 'Get stronger',
  goal_endurance: 'Build endurance',

  // Activity
  activityTitle: 'What does your typical day look like?',
  level: 'LEVEL',
  activity_1: 'Mostly sedentary',
  activity_2: 'Sitting for long periods',
  activity_3: 'Walking only',
  activity_4: 'Walking and physical activity',

  // Experience
  experienceTitle: 'Your experience level?',
  experienceHint: 'This sets the right volume, intensity and exercise complexity.',
  exp_beginner: 'Beginner',
  exp_beginner_desc: 'New to lifting or under 6 months of consistent training',
  exp_intermediate: 'Intermediate',
  exp_intermediate_desc: '6 months to 2 years of consistent training',
  exp_advanced: 'Advanced',
  exp_advanced_desc: '2+ years of structured training with solid technique',

  // Height
  heightTitle: "What's your current height?",
  cm: 'cm',
  ft: 'ft',

  // Weight
  weightTitle: "What's your current weight?",
  kg: 'kg',
  lb: 'lb',
  bmiLabel: 'Your Body Mass Index (BMI) is',
  bmi_under: 'Underweight',
  bmi_normal: 'Normal',
  bmi_over: 'Overweight',
  bmi_obese: 'Obese',
  bmi_severe: 'Severely obese',
  weightHint_under: 'Fuel first, then lift. **We build from here.**',
  weightHint_normal: 'Strong base to build on. **Let’s add muscle.**',
  weightHint_over: 'Strength training burns even at rest. **We start here.**',

  // Age
  ageTitle: 'How old are you?',
  ageHint_young: 'Your peak strength is still ahead. **Recovery is fast, so we train with a clear goal.**',
  ageHint_prime: 'Prime years for building strength. **Consistency is the whole game now.**',
  ageHint_master: 'Muscle responds at every age. **We train smart and recover well.**',

  // Muscle focus
  focusTitle: 'Which areas should we focus on?',
  m_chest: 'Chest',
  m_triceps: 'Triceps',
  m_lats: 'Lats',
  m_biceps: 'Biceps',
  m_shoulders: 'Shoulders',
  m_abs: 'Abs',
  m_quads: 'Quads',
  m_hamstrings: 'Hamstrings',
  m_glutes: 'Glutes',
  m_calves: 'Calves',
  m_back: 'Back',
  m_forearms: 'Forearms',
  fullBody: 'Full body',

  // Frequency
  frequencyTitle: 'How often can you train?',
  freq_habit: 'Easy to make a habit',
  freq_progress: 'Progress',
  timesPerWeek: '{n}× per week',
  timesPerWeek_1: 'Once a week',
  frequencyHint: '**48 hours of recovery between sessions.** That’s where muscle actually grows.',

  // Equipment
  equipmentTitle: 'What equipment do you have?',
  eq_full_gym: 'Full gym',
  eq_full_gym_desc: 'All exercises with machines, barbells and every tool.',
  eq_home_dumbbells: 'Home gym',
  eq_home_dumbbells_desc: 'Dumbbells, bands, maybe a bench.',
  eq_bodyweight: 'Bodyweight only',
  eq_bodyweight_desc: 'No equipment — just you.',

  // Reminders
  remindersTitle: 'Turn on smart reminders',
  remindersHint: 'Pick the days you train. We’ll nudge you at the right time.',
  reminderTime: 'Reminder time',
  done: 'Done',
  day_mon: 'Monday',
  day_tue: 'Tuesday',
  day_wed: 'Wednesday',
  day_thu: 'Thursday',
  day_fri: 'Friday',
  day_sat: 'Saturday',
  day_sun: 'Sunday',
  am: 'AM',
  pm: 'PM',

  // Name
  nameTitle: "What's your name?",
  namePlaceholder: 'Your name',
  nameHint: 'Nice to meet you, **{name}**. Time to build your plan.',

  // Summary
  summaryTitle: 'Your {goal} plan is ready!',
  summaryGoal: 'Goal',
  summaryFocus: 'Focus area',
  summaryEquipment: 'Equipment',
  summaryDays: 'Training days',
  start: 'Start',
  end: 'End',
  today: 'Today',
  weekN: 'Week {n}',
  perWeek: '/week',

  // Coach tab (trainee)
  coachTab: 'Coach',
  yourCoach: 'Your coach',
  coachIntro: 'Your workouts and meals are set by your coach. Ask anything here, any time.',
  messageInApp: 'Message',
  whatsapp: 'WhatsApp',
  call: 'Call',
  instagram: 'Instagram',
  linkedSince: 'Coaching you since {date}',
  notLinkedTitle: 'Link to your coach',
  notLinkedBody: 'Enter the invite code your coach gave you. Once linked, your plan and meals appear here.',
  inviteCodePlaceholder: 'ABCD2345',
  linkToCoach: 'Link to my coach',
  linkedOk: 'Linked! Your coach can now set your training and meals.',
  guestNotice: 'You are using the app without an account. Create an account to be coached.',
  sharePhotos: 'Share my progress photos',
  sharePhotosHint: 'Off by default. Your coach sees photos only while this is on.',
  yourPlan: 'Your plan',
  workoutPlanLabel: 'Workout plan',
  mealPlanLabel: 'Meal plan',
  noPlanYet: 'Not set yet',
  setBy: 'Set by your coach',
  messagesTitle: 'Messages',
  typeMessage: 'Write to your coach…',
  send: 'Send',
  noMessages: 'No messages yet. Say hi!',
  endLink: 'End coaching link',
  endLinkConfirm: 'Your coach will no longer see your training, meals or photos.',
  cancel: 'Cancel',
  planByCoach: 'Plan by Coach {name}',
  coachTargets: "Coach's targets",
  coachMealsTitle: "Coach's meal plan",
  logMeal: 'Log',
  logged: 'Logged',
  logMealDone: 'Added to today.',

  // Coach view
  athletes: 'Athletes',
  athletesSub: 'Everyone you coach',
  inviteAthlete: 'Invite an athlete',
  inviteHint: 'Generate a code and send it to them. It works once and expires in 7 days.',
  generateCode: 'Generate invite code',
  generateAnother: 'Generate another code',
  expires: 'Expires {date}',
  noAthletes: 'No athletes yet. Send someone an invite code to get started.',
  lastWorkout: 'Last workout',
  never: 'Never',
  thisWeek: 'this week',
  workoutsShort: 'workouts',
  unreadN: '{n} unread',
  progress: 'Progress',
  plan: 'Plan',
  meals: 'Meals',
  chat: 'Chat',
  assignPlan: 'Assign workout plan',
  editPlan: 'Edit plan',
  assignMeals: 'Assign meal plan',
  editMeals: 'Edit meal plan',
  noThreads: 'No conversations yet.',
  photosShared: 'Sharing progress photos',
  photosNotShared: 'Photos not shared',
  bodyWeight: 'Body weight',
  nutritionAdherence: 'Nutrition (14 days)',
  personalRecords: 'Personal records',
  noData: 'No data synced yet',
  workoutsLast30: 'workouts in 30 days',
  streakLabel: 'Streak',
};

const ar: typeof en = {
  continue: 'متابعة',
  back: 'رجوع',
  finish: 'إنهاء',
  skip: 'تخطي',
  settingUp: 'جارٍ الإعداد...',
  startNow: 'ابدأ الآن',
  selectAll: 'تحديد الكل',
  saveFailedTitle: 'فشل الحفظ',
  saveFailedBody: 'تعذّر حفظ ملفك الشخصي. حاول مرة أخرى.',
  appName: 'MY Lifestyle',

  languageTitle: 'اختر لغتك',
  languageHint: 'يمكنك تغييرها لاحقًا من ملفك الشخصي.',
  english: 'English',
  arabic: 'العربية',

  genderTitle: 'ما جنسك؟',
  male: 'ذكر',
  female: 'أنثى',

  goalTitle: 'ما هو هدفك الرئيسي؟',
  goalHint: 'زكي يصمّم برنامجك وأهداف التغذية والتدريب على مقاسك.',
  goal_muscle_gain: 'بناء العضلات',
  goal_fat_loss: 'فقدان الدهون',
  goal_strength: 'زيادة القوة',
  goal_endurance: 'بناء التحمّل',

  activityTitle: 'كيف يبدو يومك العادي؟',
  level: 'LEVEL',
  activity_1: 'قلة الحركة',
  activity_2: 'الجلوس لفترات طويلة',
  activity_3: 'المشي فقط',
  activity_4: 'المشي والنشاط البدني',

  experienceTitle: 'ما مستوى خبرتك؟',
  experienceHint: 'يحدّد الحجم والشدة وتعقيد التمارين المناسبة لك.',
  exp_beginner: 'مبتدئ',
  exp_beginner_desc: 'جديد على رفع الأثقال أو أقل من ٦ أشهر تدريب منتظم',
  exp_intermediate: 'متوسط',
  exp_intermediate_desc: 'من ٦ أشهر إلى سنتين من التدريب المنتظم',
  exp_advanced: 'متقدم',
  exp_advanced_desc: 'أكثر من سنتين تدريب منظّم بتقنية سليمة',

  heightTitle: 'ما طولك الحالي؟',
  cm: 'cm',
  ft: 'ft',

  weightTitle: 'ما وزنك الحالي؟',
  kg: 'kg',
  lb: 'lb',
  bmiLabel: 'مؤشر كتلة الجسم (BMI) لديك هو',
  bmi_under: 'نقص الوزن',
  bmi_normal: 'طبيعي',
  bmi_over: 'زيادة الوزن',
  bmi_obese: 'سمنة',
  bmi_severe: 'سمنة مفرطة',
  weightHint_under: 'الغذاء أولًا ثم الحديد. **نبني من هنا.**',
  weightHint_normal: 'قاعدة قوية نبني عليها. **نضيف عضلات.**',
  weightHint_over: 'تدريب القوة يحرق حتى أثناء الراحة. **نبدأ من هنا.**',

  ageTitle: 'كم عمرك؟',
  ageHint_young: 'ذروة قوتك ما زالت أمامك. **التعافي سريع، لذا نتدرّب بهدف واضح.**',
  ageHint_prime: 'سنوات الذروة لبناء القوة. **الاستمرارية هي اللعبة كلها الآن.**',
  ageHint_master: 'العضلات تستجيب في كل عمر. **نتدرّب بذكاء ونتعافى جيدًا.**',

  focusTitle: 'أي أجزاء نركّز عليها؟',
  m_chest: 'الصدر',
  m_triceps: 'الترايسبس',
  m_lats: 'اللاتس',
  m_biceps: 'البايسبس',
  m_shoulders: 'الكتف',
  m_abs: 'البطن',
  m_quads: 'الفخذ الأمامي',
  m_hamstrings: 'الفخذ الخلفي',
  m_glutes: 'المؤخرة',
  m_calves: 'السمانة',
  m_back: 'الظهر',
  m_forearms: 'الساعد',
  fullBody: 'الجسم بالكامل',

  frequencyTitle: 'ما عدد مرّات التدريب التي تناسبك؟',
  freq_habit: 'سهل أن يصبح عادة',
  freq_progress: 'التدرّج',
  timesPerWeek: '{n} مرات أسبوعيًا',
  timesPerWeek_1: 'مرة أسبوعيًا',
  frequencyHint: '**٤٨ ساعة تعافٍ بين الجلسات.** هناك تنمو العضلات فعليًا.',

  equipmentTitle: 'ما المعدات المتوفرة لديك؟',
  eq_full_gym: 'جيم متكامل',
  eq_full_gym_desc: 'جميع التمارين بالأجهزة والبار وكل الأدوات.',
  eq_home_dumbbells: 'جيم منزلي',
  eq_home_dumbbells_desc: 'دمبل، أحزمة مقاومة، وربما بنش.',
  eq_bodyweight: 'وزن الجسم فقط',
  eq_bodyweight_desc: 'بدون معدات — أنت فقط.',

  remindersTitle: 'فعّل التذكيرات الذكية',
  remindersHint: 'اختر أيام تدريبك وسنذكّرك في الوقت المناسب.',
  reminderTime: 'وقت التذكير',
  done: 'تم',
  day_mon: 'الاثنين',
  day_tue: 'الثلاثاء',
  day_wed: 'الأربعاء',
  day_thu: 'الخميس',
  day_fri: 'الجمعة',
  day_sat: 'السبت',
  day_sun: 'الأحد',
  am: 'ص',
  pm: 'م',

  nameTitle: 'ما اسمك؟',
  namePlaceholder: 'اسمك',
  nameHint: 'تشرّفت بمعرفتك، **{name}**. حان وقت بناء خطتك.',

  summaryTitle: 'خطة {goal} جاهزة!',
  summaryGoal: 'الهدف',
  summaryFocus: 'منطقة التركيز',
  summaryEquipment: 'المعدات',
  summaryDays: 'أيام التدريب',
  start: 'البداية',
  end: 'النهاية',
  today: 'اليوم',
  weekN: 'الأسبوع {n}',
  perWeek: '/أسبوع',

  coachTab: 'المدرب',
  yourCoach: 'مدربك',
  coachIntro: 'تمارينك ووجباتك يحددها مدربك. اسأل أي شيء هنا في أي وقت.',
  messageInApp: 'رسالة',
  whatsapp: 'واتساب',
  call: 'اتصال',
  instagram: 'إنستغرام',
  linkedSince: 'يدرّبك منذ {date}',
  notLinkedTitle: 'اربط حسابك بمدربك',
  notLinkedBody: 'أدخل كود الدعوة الذي أعطاك إياه مدربك. بعد الربط ستظهر خطتك ووجباتك هنا.',
  inviteCodePlaceholder: 'ABCD2345',
  linkToCoach: 'اربطني بمدربي',
  linkedOk: 'تم الربط! يمكن لمدربك الآن تحديد تدريبك ووجباتك.',
  guestNotice: 'أنت تستخدم التطبيق بدون حساب. أنشئ حسابًا ليتمكن المدرب من متابعتك.',
  sharePhotos: 'مشاركة صور تقدّمي',
  sharePhotosHint: 'مغلقة افتراضيًا. يرى مدربك الصور فقط أثناء تفعيلها.',
  yourPlan: 'خطتك',
  workoutPlanLabel: 'خطة التمرين',
  mealPlanLabel: 'خطة الوجبات',
  noPlanYet: 'لم تُحدَّد بعد',
  setBy: 'من مدربك',
  messagesTitle: 'الرسائل',
  typeMessage: 'اكتب لمدربك…',
  send: 'إرسال',
  noMessages: 'لا رسائل بعد. ابدأ الحديث!',
  endLink: 'إنهاء الربط مع المدرب',
  endLinkConfirm: 'لن يرى مدربك تدريبك أو وجباتك أو صورك بعد الآن.',
  cancel: 'إلغاء',
  planByCoach: 'خطة من المدرب {name}',
  coachTargets: 'أهداف المدرب',
  coachMealsTitle: 'خطة وجبات المدرب',
  logMeal: 'تسجيل',
  logged: 'مسجَّل',
  logMealDone: 'أُضيفت لليوم.',

  athletes: 'المتدرّبون',
  athletesSub: 'كل من تدرّبهم',
  inviteAthlete: 'دعوة متدرّب',
  inviteHint: 'أنشئ كودًا وأرسله له. يعمل مرة واحدة وينتهي خلال ٧ أيام.',
  generateCode: 'إنشاء كود دعوة',
  generateAnother: 'إنشاء كود آخر',
  expires: 'ينتهي {date}',
  noAthletes: 'لا متدرّبين بعد. أرسل كود دعوة للبدء.',
  lastWorkout: 'آخر تمرين',
  never: 'لا يوجد',
  thisWeek: 'هذا الأسبوع',
  workoutsShort: 'تمارين',
  unreadN: '{n} غير مقروءة',
  progress: 'التقدّم',
  plan: 'الخطة',
  meals: 'الوجبات',
  chat: 'محادثة',
  assignPlan: 'تعيين خطة تمرين',
  editPlan: 'تعديل الخطة',
  assignMeals: 'تعيين خطة وجبات',
  editMeals: 'تعديل خطة الوجبات',
  noThreads: 'لا محادثات بعد.',
  photosShared: 'يشارك صور التقدّم',
  photosNotShared: 'الصور غير مشاركة',
  bodyWeight: 'وزن الجسم',
  nutritionAdherence: 'التغذية (١٤ يومًا)',
  personalRecords: 'الأرقام القياسية',
  noData: 'لا بيانات مزامنة بعد',
  workoutsLast30: 'تمرينًا خلال ٣٠ يومًا',
  streakLabel: 'السلسلة',
};

export type StringKey = keyof typeof en;
const DICTS: Record<Language, typeof en> = { en, ar };

// ── Context ──────────────────────────────────────────────────

interface I18nContextValue {
  lang: Language;
  isRTL: boolean;
  ready: boolean;
  setLang: (l: Language) => Promise<void>;
  t: (key: StringKey, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue>({
  lang: 'en',
  isRTL: false,
  ready: false,
  setLang: async () => {},
  t: (key) => en[key],
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>('en');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadLanguage().then((l) => {
      setLangState(l);
      setReady(true);
    });
  }, []);

  const setLang = useCallback(async (l: Language) => {
    setLangState(l);
    await AsyncStorage.setItem(LANGUAGE_KEY, l);
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({
      lang,
      isRTL: lang === 'ar',
      ready,
      setLang,
      t: (key, vars) => interpolate(DICTS[lang][key] ?? en[key] ?? key, vars),
    }),
    [lang, ready, setLang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

export async function loadLanguage(): Promise<Language> {
  try {
    const raw = await AsyncStorage.getItem(LANGUAGE_KEY);
    return raw === 'ar' ? 'ar' : 'en';
  } catch {
    return 'en';
  }
}

function interpolate(s: string, vars?: Record<string, string | number>): string {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

/** Arabic-Indic digits for display (١٢٣) — numbers are stored as Latin. */
export function localizeDigits(value: string | number, lang: Language): string {
  const s = String(value);
  if (lang !== 'ar') return s;
  return s.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
}
