import {
  LinkIcon,
  PlugIcon,
  SpeakersIcon,
  SlidersIcon,
  MicrophoneLinesIcon,
  DrumsIcon,
  AmpIcon,
  BassIcon,
  MonitorIcon,
} from '@features/shared/ui/extras/Icons';

/** Map equipment label (or start of label) to icon for list items. Returns Icon component or null. */
export function getEquipmentIconForLabel(label) {
  if (!label || typeof label !== 'string') return null;
  const s = label.toLowerCase();
  if (s.includes('pa system') || s.startsWith('pa ')) return SpeakersIcon;
  if (s.includes('mixing') || s.includes('desk')) return SlidersIcon;
  if (s.includes('vocal mic') || s.includes('microphone') || s.includes('mic')) return MicrophoneLinesIcon;
  if (s.includes('di box')) return LinkIcon;
  if (s.includes('power socket') || s.includes('socket')) return PlugIcon;
  if (s.includes('drum kit') || s.includes('drum')) return DrumsIcon;
  if (s.includes('bass amp')) return AmpIcon;
  if (s.includes('guitar amp') || s.includes('guitar')) return AmpIcon;
  if (s.includes('bass')) return BassIcon;
  if (s.includes('stage monitor') || s.includes('monitor')) return MonitorIcon;
  if (s.includes('keyboard')) return AmpIcon;
  return null;
}
