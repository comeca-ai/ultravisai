'use client';

/**
 * Kit de citabilidade — as peças prontas pra publicar que saem da auditoria.
 *
 * A diferença pro bloco de recomendações logo acima: recomendação é texto pra
 * pessoa ler e decidir; peça é arquivo pra publicar. Por isso cada uma mostra
 * ANTES de tudo o destino ("onde isto vai") — sem o caminho, o conteúdo pronto
 * ainda deixa a pessoa parada.
 *
 * Três estados, e os três importam:
 *  - `null`  → auditoria anterior ao recurso: some, sem explicação confusa;
 *  - `[]`    → rodou e não havia nada a corrigir: é boa notícia, então aparece;
 *  - lista   → as peças.
 */

import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Copy, Download, FileCode2, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { CitabilityKitPiece } from '@/lib/actions/audits';

/** Peças que são arquivo de verdade ganham botão de baixar com o nome certo. */
const NOME_DE_ARQUIVO: Record<string, string> = {
  'llms-txt': 'llms.txt',
  'robots-ia': 'robots-ia.txt',
};

function Peca({ peca }: { peca: CitabilityKitPiece }) {
  const t = useTranslations('audit');

  const copiar = () => {
    navigator.clipboard.writeText(peca.conteudo).then(
      () => toast.success(t('copied')),
      () => toast.error(t('copyFailed')),
    );
  };

  const arquivo = NOME_DE_ARQUIVO[peca.id];
  const baixar = () => {
    const url = URL.createObjectURL(new Blob([peca.conteudo], { type: 'text/plain' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = arquivo;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="border-b py-4 last:border-b-0 last:pb-0 first:pt-0">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h4 className="text-sm font-semibold">{peca.titulo}</h4>
        <Badge variant="secondary" className="text-[10px] font-normal">
          {peca.origem === 'rascunho-ia' ? t('kit.originAi') : t('kit.originSite')}
        </Badge>
      </div>

      <p className="mb-3 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{t('kit.where')}: </span>
        {peca.onde}
      </p>

      <div className="relative rounded-md border bg-muted/50 p-3">
        <div className="absolute right-1 top-1 flex gap-1">
          {arquivo ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={baixar}
              aria-label={t('kit.download')}
              title={t('kit.download')}
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={copiar}
            aria-label={t('kit.copy')}
            title={t('kit.copy')}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </div>
        <pre className="overflow-x-auto whitespace-pre pr-16 text-xs leading-relaxed text-foreground">
          {peca.conteudo}
        </pre>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{peca.porque}</p>
    </div>
  );
}

export function CitabilityKitCard({ pecas }: { pecas: CitabilityKitPiece[] | null }) {
  // Hook antes de qualquer early-return (rules of hooks).
  const t = useTranslations('audit');

  // Auditoria anterior ao recurso: nada a mostrar e nada a explicar.
  if (pecas === null) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileCode2 className="h-4 w-4 text-primary" />
          {t('kit.title')}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {pecas.length > 0 ? t('kit.subtitle', { count: pecas.length }) : t('kit.emptySubtitle')}
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        {pecas.length === 0 ? (
          <div className="flex items-start gap-2 rounded-md border border-green-600/30 bg-green-600/5 p-3">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
            <p className="text-sm text-muted-foreground">{t('kit.empty')}</p>
          </div>
        ) : (
          pecas.map((peca) => <Peca key={peca.id} peca={peca} />)
        )}
      </CardContent>
    </Card>
  );
}
