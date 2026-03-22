/**
 * Zaki Daily Digest Scheduler
 *
 * Fires at 7:00 AM server time every day.
 * Calls Agent Zaki for a morning coaching brief and pushes it
 * to the owner via the built-in notifyOwner channel.
 *
 * The digest is intentionally lightweight — no user workout data
 * is available server-side (workouts are stored in AsyncStorage on device).
 * Zaki is prompted to give a motivational, context-aware morning brief
 * based on the day of the week and training cycle awareness.
 */

import cron from 'node-cron';
import { askZaki } from './zakiService';
import { notifyOwner } from './_core/notification';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function buildMorningPrompt(): string {
  const now = new Date();
  const dayName = DAYS[now.getDay()];
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return [
    `**MORNING COACHING BRIEF — ${dateStr.toUpperCase()}**`,
    ``,
    `It's ${dayName} morning. Yehia is about to start his day.`,
    `He follows a structured strength training program (Upper/Lower/Push/Pull/Legs split).`,
    ``,
    `Give him a sharp, energising morning coaching brief. Include:`,
    `1. A one-line motivational opener (not generic — make it feel earned)`,
    `2. One tactical training focus for today based on the day of the week`,
    `3. One nutrition reminder (protein timing, hydration, or pre-workout fuel)`,
    `4. One recovery or mindset cue`,
    ``,
    `Keep it under 150 words. Direct, specific, no fluff.`,
  ].join('\n');
}

/**
 * Start the daily digest cron job.
 * Call this once from the server entry point.
 */
export function startDailyDigestScheduler(): void {
  // Run at 07:00 every day (server timezone)
  cron.schedule('0 7 * * *', async () => {
    console.log('[Zaki Daily Digest] Starting morning brief generation...');
    try {
      const prompt = buildMorningPrompt();
      const { response } = await askZaki(prompt);

      // Trim to first 500 chars for the notification title preview
      const preview = response.length > 120
        ? response.substring(0, 117) + '...'
        : response;

      const sent = await notifyOwner({
        title: `🤖 Zaki's Morning Brief — ${new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`,
        content: response,
      });

      if (sent) {
        console.log(`[Zaki Daily Digest] Sent successfully. Preview: "${preview}"`);
      } else {
        console.warn('[Zaki Daily Digest] notifyOwner returned false — notification may not have been delivered.');
      }
    } catch (err) {
      console.error('[Zaki Daily Digest] Failed to generate or send digest:', err);
    }
  }, {
    timezone: 'Asia/Dubai', // Yehia's timezone (UTC+4)
  });

  console.log('[Zaki Daily Digest] Scheduler started — will fire daily at 07:00 Dubai time.');
}

/**
 * Trigger the digest immediately (for testing or manual trigger via tRPC).
 */
export async function triggerDailyDigestNow(): Promise<{ success: boolean; preview: string }> {
  const prompt = buildMorningPrompt();
  const { response } = await askZaki(prompt);
  const sent = await notifyOwner({
    title: `🤖 Zaki's Morning Brief — ${new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`,
    content: response,
  });
  return {
    success: sent,
    preview: response.substring(0, 200),
  };
}

interface YesterdayWorkout {
  sessionName: string;
  durationMinutes?: number;
  totalVolume?: number;
  exerciseCount?: number;
  topExercise?: string;
  topWeight?: number;
}

interface PersonalizedDigestInput {
  yesterdayWorkout?: YesterdayWorkout;
  recoveryScore?: number;
  sleepScore?: number;
}

function buildPersonalizedPrompt(input: PersonalizedDigestInput): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const lines: string[] = [
    `**PERSONALISED MORNING COACHING BRIEF — ${dateStr.toUpperCase()}**`,
    '',
  ];

  if (input.yesterdayWorkout) {
    const w = input.yesterdayWorkout;
    lines.push('**Yesterday\'s Training:**');
    lines.push(`Session: ${w.sessionName}`);
    if (w.durationMinutes) lines.push(`Duration: ${w.durationMinutes} minutes`);
    if (w.totalVolume) lines.push(`Total volume: ${w.totalVolume.toLocaleString()}kg`);
    if (w.exerciseCount) lines.push(`Exercises completed: ${w.exerciseCount}`);
    if (w.topExercise && w.topWeight) lines.push(`Top lift: ${w.topExercise} @ ${w.topWeight}kg`);
    lines.push('');
  } else {
    lines.push('**Yesterday:** Rest day or no workout logged.');
    lines.push('');
  }

  if (input.recoveryScore !== undefined) {
    const status = input.recoveryScore >= 67 ? 'Green ✅' : input.recoveryScore >= 34 ? 'Yellow ⚡' : 'Red 🔴';
    lines.push(`**Today\'s Recovery:** ${Math.round(input.recoveryScore)}% — ${status}`);
  }
  if (input.sleepScore !== undefined) {
    lines.push(`**Sleep Score:** ${Math.round(input.sleepScore)}%`);
  }
  lines.push('');

  lines.push('Give Yehia a sharp, personalised morning coaching brief based on this real data. Include:');
  lines.push('1. A one-line opener that references his actual yesterday performance (not generic)');
  lines.push('2. One tactical focus for today based on his recovery and yesterday\'s session');
  lines.push('3. One specific nutrition or hydration cue for today');
  lines.push('4. One recovery or mindset cue');
  lines.push('');
  lines.push('Keep it under 150 words. Direct, specific, grounded in the data above.');

  return lines.join('\n');
}

/**
 * Trigger a personalised digest with real workout data from the client.
 */
export async function triggerPersonalizedDigestNow(
  input: PersonalizedDigestInput
): Promise<{ success: boolean; preview: string }> {
  const prompt = buildPersonalizedPrompt(input);
  const { response } = await askZaki(prompt);
  const sent = await notifyOwner({
    title: `🤖 Zaki's Morning Brief — ${new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`,
    content: response,
  });
  return {
    success: sent,
    preview: response.substring(0, 200),
  };
}
