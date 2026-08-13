'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Copy, KeyRound, Loader2, Plus, Trash2 } from 'lucide-react';

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? '';

function getMcpEndpoint(): string {
  const appUrl = configuredAppUrl || (typeof window !== 'undefined' ? window.location.origin : '');
  return `${appUrl}/api/mcp`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function ApiKeysSection() {
  const t = useTranslations('settings.apiKeysSection');
  const tCommon = useTranslations('common');
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const mcpEndpoint = getMcpEndpoint();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/keys');
      const body = (await res.json()) as { keys?: ApiKey[]; error?: string };
      if (!res.ok) throw new Error(body.error || t('errors.load'));
      setKeys(body.keys ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('errors.load'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const body = (await res.json()) as {
        key?: ApiKey & { token: string };
        error?: string;
      };
      if (!res.ok || !body.key) throw new Error(body.error || t('errors.create'));
      setRevealedToken(body.key.token);
      setNewName('');
      setCreateOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('errors.create'));
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm(t('revokeConfirm'))) {
      return;
    }
    try {
      const res = await fetch(`/api/keys/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || t('errors.revoke'));
      }
      toast.success(t('keyRevoked'));
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('errors.revoke'));
    }
  };

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast.success(t('copied'));
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              {t('title')}
            </CardTitle>
            <CardDescription>{t('description')}</CardDescription>
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5 shrink-0">
            <Plus className="h-4 w-4" />
            {t('newKey')}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-md border bg-muted/40 p-3 text-xs space-y-1.5">
          <p className="font-medium text-foreground">{t('mcpEndpoint')}</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate font-mono">{mcpEndpoint}</code>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2"
              onClick={() => copy(mcpEndpoint)}
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
          <p className="text-muted-foreground">
            {t('mcpInstructions')}{' '}
            <a href="https://ultravis.ai" target="_blank" rel="noreferrer" className="underline">
              {t('mcpGuide')}
            </a>
            .
          </p>
        </div>

        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : keys.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">{t('empty')}</p>
        ) : (
          <div className="divide-y rounded-md border">
            {keys.map((k) => {
              const revoked = !!k.revoked_at;
              return (
                <div key={k.id} className="flex items-center justify-between gap-4 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{k.name}</p>
                      {revoked && (
                        <Badge variant="outline" className="text-[10px]">
                          {t('revokedBadge')}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">{k.prefix}…</p>
                    <p className="text-[11px] text-muted-foreground">
                      {t('createdLastUsed', {
                        created: formatDate(k.created_at),
                        lastUsed: formatDate(k.last_used_at),
                      })}
                    </p>
                  </div>
                  {!revoked && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRevoke(k.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('createTitle')}</DialogTitle>
            <DialogDescription>{t('createDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="apiKeyName">{t('nameLabel')}</Label>
            <Input
              id="apiKeyName"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t('namePlaceholder')}
              autoFocus
              disabled={creating}
            />
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" disabled={creating} />}>
              {tCommon('cancel')}
            </DialogClose>
            <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!revealedToken} onOpenChange={(v) => !v && setRevealedToken(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('revealTitle')}</DialogTitle>
            <DialogDescription>{t('revealDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-2 font-mono text-xs">
              <code className="flex-1 truncate">{revealedToken}</code>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => revealedToken && copy(revealedToken)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setRevealedToken(null)}>{t('done')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
