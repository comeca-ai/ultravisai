'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  createTopic,
  deleteTopic,
  getPromptCountByTopic,
  getTopics,
  updateTopic,
} from '@/lib/actions/topic';
import type { Topic } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Check, Loader2, Lock, Pencil, Plus, Tag, Trash2, X } from 'lucide-react';
import { useUserRole } from '@/hooks/use-user-role';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function BrandTopicsPage({ params }: PageProps) {
  const t = useTranslations('brands.manageTopics');
  const tTopics = useTranslations('topics');
  const tCommon = useTranslations('common');
  const { id: brandId } = use(params);

  const [topics, setTopics] = useState<Topic[]>([]);
  const [promptCounts, setPromptCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const { canManage } = useUserRole();

  const load = useCallback(
    async (isCancelled?: () => boolean) => {
      setIsLoading(true);
      try {
        const data = await getTopics(brandId);
        if (isCancelled?.()) return;
        setTopics(data);
        const counts: Record<string, number> = {};
        await Promise.all(
          data.map(async (topic) => {
            counts[topic.id] = await getPromptCountByTopic(brandId, topic.name);
          }),
        );
        if (isCancelled?.()) return;
        setPromptCounts(counts);
      } catch {
        if (isCancelled?.()) return;
        toast.error(t('loadError'));
      } finally {
        if (!isCancelled?.()) setIsLoading(false);
      }
    },
    [brandId, t],
  );

  useEffect(() => {
    let cancelled = false;
    load(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [load]);

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    if (topics.some((topic) => topic.name.toLowerCase() === name.toLowerCase())) {
      toast.error(tTopics('topicAlreadyExists'));
      return;
    }
    setIsAdding(true);
    try {
      const added = await createTopic(brandId, name);
      setTopics((prev) => [...prev, added]);
      setNewName('');
      toast.success(tTopics('topicAdded', { name: added.name }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tTopics('failedToAddTopic'));
    } finally {
      setIsAdding(false);
    }
  };

  const handleEdit = async (id: string) => {
    const name = editName.trim();
    if (!name) return;
    if (
      topics.some((topic) => topic.id !== id && topic.name.toLowerCase() === name.toLowerCase())
    ) {
      toast.error(tTopics('topicAlreadyExists'));
      return;
    }
    try {
      const updated = await updateTopic(id, name);
      setTopics((prev) => prev.map((topic) => (topic.id === id ? updated : topic)));
      setEditingId(null);
      toast.success(t('topicUpdated'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('updateError'));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTopic(id);
      setTopics((prev) => prev.filter((topic) => topic.id !== id));
      toast.success(t('topicRemoved'));
    } catch {
      toast.error(t('removeError'));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Tag className="h-4 w-4" />
          {t('title')}
        </CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {topics.length > 0 && (
              <div className="space-y-2">
                {topics.map((topic) => (
                  <div
                    key={topic.id}
                    className="flex items-center gap-3 rounded-lg border px-3 py-2.5"
                  >
                    <Tag className="h-4 w-4 shrink-0 text-muted-foreground" />

                    {editingId === topic.id ? (
                      <div className="flex flex-1 items-center gap-2">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleEdit(topic.id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          className="h-8 text-sm"
                          autoFocus
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={() => handleEdit(topic.id)}
                          aria-label={t('saveAria')}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={() => setEditingId(null)}
                          aria-label={t('cancelAria')}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <p className="flex-1 truncate text-sm font-medium">{topic.name}</p>
                        {canManage && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0"
                              onClick={() => {
                                setEditingId(topic.id);
                                setEditName(topic.name);
                              }}
                              aria-label={t('editAria')}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Dialog>
                              <DialogTrigger
                                render={
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                                    aria-label={t('deleteAria')}
                                  />
                                }
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </DialogTrigger>
                              <DialogContent className="sm:max-w-sm">
                                <DialogHeader>
                                  <DialogTitle>{t('deleteTitle')}</DialogTitle>
                                  <DialogDescription>
                                    {t('deleteConfirm', { name: topic.name })}{' '}
                                    {(promptCounts[topic.id] ?? 0) > 0
                                      ? t('deleteWithPrompts', { count: promptCounts[topic.id] })
                                      : t('deleteNoPrompts')}
                                  </DialogDescription>
                                </DialogHeader>
                                <DialogFooter>
                                  <DialogClose render={<Button variant="outline" />}>
                                    {tCommon('cancel')}
                                  </DialogClose>
                                  <DialogClose
                                    render={
                                      <Button
                                        variant="destructive"
                                        onClick={() => handleDelete(topic.id)}
                                      />
                                    }
                                  >
                                    {tCommon('delete')}
                                  </DialogClose>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            {topics.length === 0 && (
              <div className="rounded-lg border border-dashed py-8 text-center">
                <p className="text-sm text-muted-foreground">{t('emptyState')}</p>
              </div>
            )}

            {canManage ? (
              <>
                <Separator />

                <div id="add-topic" className="space-y-2 scroll-mt-24">
                  <Label className="text-sm font-medium">{tTopics('addTopic')}</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder={t('addPlaceholder')}
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && newName.trim() && handleAdd()}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      onClick={handleAdd}
                      disabled={isAdding || !newName.trim()}
                      className="gap-1.5 shrink-0"
                    >
                      {isAdding ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                      {t('addButton')}
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              // Read-only banner — non-admin / non-manager roles can't INSERT
              // into topics at the DB layer (RLS). Hide the Add form and
              // surface the reason instead of letting them hit a generic
              // "Failed to add topic" toast.
              <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-3 text-sm">
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="font-medium">{t('readOnlyTitle')}</p>
                  <p className="mt-1 text-muted-foreground">{t('readOnlyBody')}</p>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
