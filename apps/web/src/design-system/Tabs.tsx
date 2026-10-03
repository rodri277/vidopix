import { useId, useState, type KeyboardEvent, type ReactNode } from 'react';
import styles from './Tabs.module.css';

export interface TabDefinition {
  readonly id: string;
  readonly label: string;
  readonly content: ReactNode;
}

interface Props {
  readonly label: string;
  readonly tabs: readonly TabDefinition[];
}

/** Tabs following the ARIA pattern: one Tab stop, arrows move and activate, Home and End jump. */
export function Tabs({ label, tabs }: Props) {
  const [activeId, setActiveId] = useState(tabs[0]?.id ?? '');
  const baseId = useId();
  const activeIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.id === activeId),
  );
  const active = tabs[activeIndex];

  const onKeyDown = (event: KeyboardEvent): void => {
    let next = activeIndex;
    if (event.key === 'ArrowRight') next = (activeIndex + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (activeIndex - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault();
    const target = tabs[next];
    if (!target) return;
    setActiveId(target.id);
    requestAnimationFrame(() => {
      document.getElementById(`${baseId}-tab-${target.id}`)?.focus();
    });
  };

  return (
    <div>
      <div className={styles.list} role="tablist" aria-label={label}>
        {tabs.map((tab) => {
          const selected = tab.id === active?.id;
          return (
            <button
              key={tab.id}
              id={`${baseId}-tab-${tab.id}`}
              type="button"
              role="tab"
              className={styles.tab}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => {
                setActiveId(tab.id);
              }}
              onKeyDown={onKeyDown}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {active ? (
        <div
          key={active.id}
          id={`${baseId}-panel-${active.id}`}
          role="tabpanel"
          className={styles.panel}
          aria-labelledby={`${baseId}-tab-${active.id}`}
        >
          {active.content}
        </div>
      ) : null}
    </div>
  );
}
