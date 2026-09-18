// ============================================================
// THE COACH — Mohamad Yousry ("MY" in MY Lifestyle)
// Single-coach app: this card is what every trainee sees on the
// Coach tab. Contact channels render only when filled in.
// ============================================================

export const COACH = {
  name: 'Mohamad Yousry',
  nameAr: 'محمد يسري',
  title: 'Personal Trainer & Nutrition Coach',
  titleAr: 'مدرب شخصي ومدرب تغذية',
  photo: require('@/assets/images/coach-mohamad.jpg'),
  avatar: require('@/assets/images/coach-mohamad-avatar.jpg'),
  /** E.164, e.g. "+9715xxxxxxx". Empty = button hidden. */
  phone: '',
  /** E.164 without "+", e.g. "9715xxxxxxx". Empty = button hidden. */
  whatsapp: '',
  /** Handle without "@". Empty = button hidden. */
  instagram: '',
  email: '',
} as const;
