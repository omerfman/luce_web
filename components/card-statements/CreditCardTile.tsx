'use client';

import React, { useState, useEffect } from 'react';

type Props = {
  cardKey: string;
  cardLastFour: string;
  cardHolderName: string;
  itemCount: number;
  canEditName: boolean;
  onOpen: () => void;
  onSaveHolderName: (cardKey: string, newName: string) => Promise<void>;
};

export function CreditCardTile({
  cardKey,
  cardLastFour,
  cardHolderName,
  itemCount,
  canEditName,
  onOpen,
  onSaveHolderName,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(cardHolderName);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(cardHolderName);
  }, [cardHolderName, editing]);

  async function commit() {
    const next = draft.trim();
    if (next === cardHolderName.trim()) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSaveHolderName(cardKey, next);
      setEditing(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Kayıt başarısız';
      alert(msg);
    } finally {
      setSaving(false);
    }
  }

  const displayFour = (cardLastFour || '—').replace(/\D/g, '').slice(-4).padStart(4, '•') || '••••';

  return (
    <div className="group relative w-full max-w-[340px] min-w-[260px]">
      <button
        type="button"
        onClick={onOpen}
        className="w-full text-left rounded-2xl overflow-hidden shadow-lg ring-1 ring-black/10 transition-transform hover:scale-[1.02] hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
      >
        <div
          className="relative aspect-[1.586/1] w-full p-5 flex flex-col justify-between text-white bg-gradient-to-br from-slate-800 via-indigo-900 to-slate-900"
          style={{ minHeight: 200 }}
        >
          <div className="flex justify-between items-start gap-2">
            <div className="flex items-center gap-2">
              <span className="inline-block w-10 h-7 rounded bg-gradient-to-br from-amber-200/90 to-amber-600/80 shadow-inner" />
              <span className="text-[10px] uppercase tracking-widest text-white/50 font-medium">
                Kredi Kartı
              </span>
            </div>
            {itemCount > 0 && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/15 text-white/90 font-medium">
                {itemCount} işlem
              </span>
            )}
          </div>

          <div className="space-y-1">
            <p className="font-mono text-lg sm:text-xl tracking-[0.2em] text-white/95">
              •••• &nbsp; •••• &nbsp; •••• &nbsp; {displayFour}
            </p>
            <div className="pt-2 border-t border-white/10">
              <p className="text-[10px] uppercase tracking-wider text-white/45 mb-1">
                Kartı kullanan
              </p>
              <p className="text-sm font-medium leading-snug line-clamp-2 pr-6">
                {cardHolderName}
              </p>
            </div>
          </div>
        </div>
      </button>

      {canEditName && (
        <div className="mt-2 flex flex-col gap-1.5">
          {editing ? (
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void commit();
                  if (e.key === 'Escape') {
                    setDraft(cardHolderName);
                    setEditing(false);
                  }
                }}
                disabled={saving}
                className="flex-1 min-w-0 px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ad Soyad"
                aria-label="Kart kullanıcısı adı"
              />
              <button
                type="button"
                disabled={saving}
                onClick={(e) => {
                  e.stopPropagation();
                  void commit();
                }}
                className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? '…' : 'Kaydet'}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setEditing(true);
              }}
              className="text-xs text-blue-600 hover:text-blue-800 text-left"
            >
              İsmi düzenle (aramada kullanılır)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
