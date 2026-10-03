import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import styles from './MenuBar.module.css';

export interface MenuItem {
  readonly label: string;
  readonly shortcut?: string;
  readonly disabled?: boolean;
  readonly separatorBefore?: boolean;
  /** Marks the item as the current choice of a group (rendered as a menu radio item). */
  readonly checked?: boolean;
  readonly onSelect: () => void;
}

export interface MenuDefinition {
  readonly label: string;
  readonly items: readonly MenuItem[];
}

interface Props {
  readonly label: string;
  readonly menus: readonly MenuDefinition[];
}

/** Menu bar following the ARIA menubar pattern: arrows move, Enter selects, Escape closes. */
export function MenuBar({ label, menus }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const baseId = useId();

  useEffect(() => {
    if (openIndex === null) return;
    const onPointerDown = (event: PointerEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) setOpenIndex(null);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [openIndex]);

  const focusTrigger = (index: number): void => {
    rootRef.current?.querySelector<HTMLElement>(`[data-trigger="${String(index)}"]`)?.focus();
  };

  const focusItem = (index: number, itemIndex: number): void => {
    const items = rootRef.current?.querySelectorAll<HTMLElement>(
      `[data-menu="${String(index)}"] [role^="menuitem"]:not(:disabled)`,
    );
    if (!items || items.length === 0) return;
    const wrapped = (itemIndex + items.length) % items.length;
    items[wrapped]?.focus();
  };

  const openMenu = (index: number, focusFirst: boolean): void => {
    setOpenIndex(index);
    if (focusFirst)
      requestAnimationFrame(() => {
        focusItem(index, 0);
      });
  };

  const onTriggerKeyDown = (event: KeyboardEvent, index: number): void => {
    const count = menus.length;
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const next = (index + (event.key === 'ArrowRight' ? 1 : -1) + count) % count;
      focusTrigger(next);
      if (openIndex !== null) openMenu(next, false);
    } else if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openMenu(index, true);
    } else if (event.key === 'Escape') {
      setOpenIndex(null);
    }
  };

  const onItemKeyDown = (event: KeyboardEvent, index: number): void => {
    const items = Array.from(
      rootRef.current?.querySelectorAll<HTMLElement>(
        `[data-menu="${String(index)}"] [role^="menuitem"]:not(:disabled)`,
      ) ?? [],
    );
    const current = items.indexOf(event.target as HTMLElement);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusItem(index, current + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusItem(index, current - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      focusItem(index, 0);
    } else if (event.key === 'End') {
      event.preventDefault();
      focusItem(index, items.length - 1);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpenIndex(null);
      focusTrigger(index);
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const next = (index + (event.key === 'ArrowRight' ? 1 : -1) + menus.length) % menus.length;
      openMenu(next, true);
      focusTrigger(next);
      requestAnimationFrame(() => {
        focusItem(next, 0);
      });
    } else if (event.key === 'Tab') {
      setOpenIndex(null);
    }
  };

  return (
    <div ref={rootRef} className={styles.bar} role="menubar" aria-label={label}>
      {menus.map((menu, index) => {
        const open = openIndex === index;
        const menuId = `${baseId}-${String(index)}`;
        return (
          <div key={menu.label} className={styles.menu}>
            <button
              type="button"
              role="menuitem"
              className={styles.trigger}
              data-trigger={index}
              aria-haspopup="menu"
              aria-expanded={open}
              aria-controls={open ? menuId : undefined}
              onClick={() => {
                setOpenIndex(open ? null : index);
              }}
              onMouseEnter={() => {
                if (openIndex !== null) setOpenIndex(index);
              }}
              onKeyDown={(event) => {
                onTriggerKeyDown(event, index);
              }}
            >
              {menu.label}
            </button>
            {open ? (
              <div
                id={menuId}
                className={styles.list}
                role="menu"
                aria-label={menu.label}
                data-menu={index}
              >
                {menu.items.map((item) => (
                  <div key={item.label} role="none">
                    {item.separatorBefore ? (
                      <div className={styles.separator} role="separator" />
                    ) : null}
                    <button
                      type="button"
                      role={item.checked === undefined ? 'menuitem' : 'menuitemradio'}
                      aria-checked={item.checked}
                      className={styles.item}
                      disabled={item.disabled === true}
                      onClick={() => {
                        setOpenIndex(null);
                        item.onSelect();
                      }}
                      onKeyDown={(event) => {
                        onItemKeyDown(event, index);
                      }}
                    >
                      <span>{item.label}</span>
                      {item.shortcut ? (
                        <span className={styles.shortcut}>{item.shortcut}</span>
                      ) : null}
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
