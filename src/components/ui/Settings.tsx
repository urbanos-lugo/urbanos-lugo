import { Globe, House, Moon } from 'lucide-react';
import { navSections, type NavTab } from '../navSections';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { LANGS, LANG_CODE, LANG_NAME, useLang, useT, type Lang } from '../../i18n';
import type { ThemeChoice } from '../../hooks/useTheme';

const pressed = (on: boolean) => `h-tap flex-1 rounded-inset border text-label font-semibold ${on ? 'border-ink bg-ink text-bg' : 'border-edge text-ink-2'}`;

/** A labelled row of settings buttons. The heading beside the group is for the eye; the group carries the name. */
function Row({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2 px-1 text-label text-ink-3">
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        {label}
      </div>
      {/* Wraps only when the words do not fit: the four tabs at 200 % text ran 41 px past the drawer. */}
      <div role="group" aria-label={label} className="flex flex-wrap gap-1">
        {children}
      </div>
    </div>
  );
}

export interface SettingsProps {
  theme: ThemeChoice;
  setTheme: (choice: ThemeChoice) => void;
  setLang: (lang: Lang) => void;
  start: NavTab;
  setStart: (tab: NavTab) => void;
}

/** Dark, light or automatic, the three languages and the tab to open on — the same controls in the menu and the desktop rail. */
export function Settings({ theme, setTheme, setLang, start, setStart }: SettingsProps) {
  const t = useT();
  const lang = useLang();
  const themes: { id: ThemeChoice; label: string }[] = [
    { id: 'auto', label: t.menu.themeAutoShort },
    { id: 'light', label: t.menu.themeLight },
    { id: 'dark', label: t.menu.themeDark },
  ];
  return (
    <div className="flex flex-col gap-3">
      <Row icon={Moon} label={t.menu.theme}>
        {themes.map(({ id, label }) => (
          <button key={id} onClick={() => setTheme(id)} aria-pressed={theme === id} className={pressed(theme === id)}>
            {label}
          </button>
        ))}
      </Row>
      <Row icon={Globe} label={t.menu.language}>
        {LANGS.map((code) => (
          // Each language named in itself, with the code kept so "click GL" still finds it by voice.
          <button key={code} onClick={() => setLang(code)} aria-pressed={lang === code} aria-label={`${LANG_CODE[code]}: ${LANG_NAME[code]}`} lang={code} className={pressed(lang === code)}>
            {LANG_CODE[code]}
          </button>
        ))}
      </Row>
      <Row icon={House} label={t.menu.start}>
        {navSections(t).map(({ id, label }) => (
          <button key={id} onClick={() => setStart(id)} aria-pressed={start === id} className={pressed(start === id)}>
            {label}
          </button>
        ))}
      </Row>
    </div>
  );
}
