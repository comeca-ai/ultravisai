import { describe, it, expect } from 'vitest';
import {
  countBrandMentions,
  parseResponse,
  contarCitacoesDoProduto,
  citacaoTrazOProduto,
} from './response-parser.js';

describe('response-parser', () => {
  describe('countBrandMentions', () => {
    it('should count occurrences of brand name and its domains case-insensitively', () => {
      const brand = {
        brandName: 'Acme',
        domains: ['acme.com', 'acme-corp.com'],
      };
      const text =
        'Acme is great. You can visit acme.com or email contact@acme-corp.com. ACME is case-insensitive.';
      // Brand Name: Acme (1) + ACME (1) = 2
      // Domains: acme.com (1) + acme-corp.com (1) = 2
      // In addition, the brand name "Acme" also matches the "acme" part of "acme.com" and "acme-corp.com" due to word boundaries.
      // So brand name matches = 4, domains match = 2. Total = 6.
      expect(countBrandMentions(text, brand)).toBe(6);
    });

    it('should strip URLs to prevent double-counting domains in markdown link URLs or bare URLs', () => {
      const brand = {
        brandName: 'Acme',
        domains: ['acme.com'],
      };
      // Markdown link: [Acme](https://acme.com/about)
      // If stripped, it becomes: Acme (which has 1 mention of brandName). The domain acme.com in the URL is stripped and NOT counted.
      const text =
        'Check [Acme](https://acme.com/about) or go to bare URL https://acme.com/home directly.';
      // Stripped text should be: "Check Acme or go to bare URL  directly."
      // Mentions: "Acme" (1 mention). "acme.com" should not appear in the stripped text.
      expect(countBrandMentions(text, brand)).toBe(1);
    });

    it('should return 0 if there are no brand mentions or domains in the text', () => {
      const brand = {
        brandName: 'Acme',
        domains: ['acme.com'],
      };
      const text = 'Some other text about Globex and globex.com.';
      expect(countBrandMentions(text, brand)).toBe(0);
    });
  });

  describe('countBrandMentions with aliases (Ultravis)', () => {
    it('counts alias occurrences as brand mentions (Polar Electro case)', () => {
      const brand = { brandName: 'Polar Electro', domains: ['polar.com'], aliases: ['Polar'] };
      const text = 'O Polar Vantage V3 é ótimo. A Polar também tem o H10.';
      // "Polar Electro" nunca aparece; alias "Polar" aparece 2×.
      expect(countBrandMentions(text, brand)).toBe(2);
    });

    it('is backward compatible when aliases is absent', () => {
      const brand = { brandName: 'Acme', domains: [] };
      expect(countBrandMentions('Acme wins.', brand)).toBe(1);
    });

    it('parseResponse also counts aliases in mentionCount', () => {
      const brand = { brandName: 'Polar Electro', domains: [], aliases: ['Polar'] };
      const result = parseResponse(
        { text: 'A Polar lidera em GPS de corrida.', citations: [] },
        brand,
        'neutral',
        [],
      );
      expect(result.mentionCount).toBe(1);
    });
  });

  describe('parseResponse', () => {
    const brand = {
      brandName: 'Acme',
      domains: ['acme.com', 'acme-corp.com'],
    };

    describe('brand mention count', () => {
      it('should count brand mentions in response object, stripping URLs first', () => {
        const response = {
          text: 'We recommend [Acme](https://acme.com). Acme rules!',
          citations: [{ url: 'https://acme.com', title: 'Acme Inc' }],
        };
        const result = parseResponse(response, brand, 'neutral');
        // Stripped: "We recommend Acme. Acme rules!"
        // Mentions: "Acme" (2)
        expect(result.mentionCount).toBe(2);
      });
    });

    describe('citation count', () => {
      it('should count case-insensitive hostname matches against citations[].url', () => {
        const response = {
          text: 'Acme is featured in these links.',
          citations: [
            { url: 'https://ACME.com/page1', title: 'Page 1' },
            { url: 'https://www.acme-corp.com/info', title: 'Page 2' },
          ],
        };
        const result = parseResponse(response, brand, 'neutral');
        // acme.com matches ACME.com/page1; acme-corp.com matches the www variant.
        expect(result.citationCount).toBe(2);
      });

      it('should count subdomains of a brand domain', () => {
        const response = {
          text: 'Acme docs.',
          citations: [{ url: 'https://docs.acme.com/setup', title: 'Docs' }],
        };
        const result = parseResponse(response, brand, 'neutral');
        expect(result.citationCount).toBe(1);
      });

      it('não conta parâmetro de rastreamento que carrega o nome da marca', () => {
        const response = {
          text: 'Acme is referenced.',
          citations: [{ url: 'https://other.com/?ref=acme.com', title: 'Query lookalike' }],
        };
        const result = parseResponse(response, brand, 'neutral');
        // O host é other.com e o termo só aparece na QUERY — `?ref=` é
        // rastreamento, não link de produto. Só o caminho da URL conta.
        expect(result.citationCount).toBe(0);
      });

      it('should count a citation once even if multiple brand domains match it', () => {
        const response = {
          text: 'Acme link.',
          citations: [{ url: 'https://acme.com/acme-corp.com', title: 'Double match' }],
        };
        const result = parseResponse(response, brand, 'neutral');
        // Only one citation exists, so citationCount should be at most 1
        expect(result.citationCount).toBe(1);
      });
    });

    // ── Citação = link que traz o produto (decisão do dono, 07/set) ──────────
    describe('citação em fonte de terceiro (ajustar.md Parte 3)', () => {
      it('conta o link de terceiro que traz o produto no título', () => {
        const response = {
          text: 'A Acme aparece na imprensa.',
          citations: [
            { url: 'https://techtudo.com.br/review/x1-analise', title: 'Acme X1: análise' },
          ],
        };
        // Antes desta regra isso valia ZERO — justamente o caso em que a marca
        // NÃO controla a página, que é o que dá valor de autoridade ao sinal.
        expect(parseResponse(response, brand, 'neutral').citationCount).toBe(1);
      });

      it('conta pelo slug, com os separadores normalizados', () => {
        const cite = { url: 'https://techtudo.com.br/review/acme-x1-analise', title: 'Análise' };
        expect(citacaoTrazOProduto(cite, ['Acme X1'])).toBe(true);
      });

      it('exige palavra inteira — "polarizado" não é a Polar', () => {
        const cite = { url: 'https://exemplo.com/oculos-polarizado', title: 'Óculos polarizado' };
        expect(citacaoTrazOProduto(cite, ['Polar'])).toBe(false);
      });

      it('termo composto protege marca de nome comum', () => {
        const clima = { url: 'https://g1.com/clima/vortice-polar', title: 'O vórtice polar' };
        // Com o nome sozinho, a matéria sobre clima entraria na conta.
        expect(citacaoTrazOProduto(clima, ['Polar'])).toBe(true);
        // É pra isso que existe `citation_terms`.
        expect(citacaoTrazOProduto(clima, ['Polar Vantage'])).toBe(false);
      });

      it('separa própria de terceiro e nunca conta a mesma citação duas vezes', () => {
        const citations = [
          { url: 'https://acme.com/x1', title: 'Acme X1' }, // própria (e o título casa)
          { url: 'https://techtudo.com.br/acme-x1', title: 'Análise' }, // terceiro
          { url: 'https://outro.com/generico', title: 'Nada a ver' }, // nenhuma
        ];
        const r = contarCitacoesDoProduto(citations, {
          domains: ['acme.com'],
          termos: ['Acme X1'],
        });
        expect(r).toEqual({ total: 2, proprias: 1, terceiros: 1 });
      });

      it('sem termos, só o domínio próprio conta', () => {
        const citations = [{ url: 'https://techtudo.com.br/acme-x1', title: 'Acme X1' }];
        expect(contarCitacoesDoProduto(citations, { domains: ['acme.com'], termos: [] })).toEqual({
          total: 0,
          proprias: 0,
          terceiros: 0,
        });
      });

      it('ignora acento na comparação', () => {
        const cite = { url: 'https://exemplo.com/analise', title: 'Análise do Cafés Grão' };
        expect(citacaoTrazOProduto(cite, ['cafes grao'])).toBe(true);
      });

      it('citationTerms tem precedência sobre nome e aliases', () => {
        const marcaGenerica = {
          brandName: 'Polar',
          domains: ['polar.com'],
          aliases: ['Polar Electro'],
          citationTerms: ['Polar Vantage'],
        };
        const response = {
          text: 'Sobre o clima.',
          citations: [{ url: 'https://g1.com/clima/vortice-polar', title: 'O vórtice polar' }],
        };
        expect(parseResponse(response, marcaGenerica, 'neutral').citationCount).toBe(0);
      });

      it('expõe a quebra própria × terceiro no retorno do parseResponse', () => {
        const response = {
          text: 'Acme.',
          citations: [
            { url: 'https://acme.com/x1', title: 'X1' },
            { url: 'https://techtudo.com.br/acme-x1-analise', title: 'Análise' },
          ],
        };
        const r = parseResponse(response, brand, 'neutral');
        expect(r.citationOwnCount).toBe(1);
        expect(r.citationThirdPartyCount).toBe(1);
        expect(r.citationCount).toBe(2);
      });
    });

    describe('visibility score calculation', () => {
      // Visibility Score rules:
      // Mention component: Math.min(mentionCount * 10, 40)
      // Citation component: Math.min(citationCount * 15, 30)
      // Citation ratio bonus: Math.round((citationCount / totalCitations) * 15)
      // Sentiment bonus:
      //   positive -> +15
      //   neutral and mentionCount > 0 -> +7
      //   else -> 0
      // Max score = 100

      it('should compute score with positive sentiment and mention/citation counts', () => {
        const response = {
          text: 'Acme Acme Acme Acme', // 4 mentions -> 40 points
          citations: [
            { url: 'https://acme.com', title: 'Link 1' }, // 1 citation -> 15 points
            { url: 'https://other.com', title: 'Link 2' },
          ],
        };
        // totalCitations = 2, citationCount = 1
        // citation ratio = 1/2 * 15 = 7.5 -> Math.round(7.5) = 8 points
        // sentiment = positive -> 15 points
        // Expected score = 40 + 15 + 8 + 15 = 78
        const result = parseResponse(response, brand, 'positive');
        expect(result.visibilityScore).toBe(78);
      });

      it('should compute score with neutral sentiment and mentionCount > 0', () => {
        const response = {
          text: 'Acme Acme', // 2 mentions -> 20 points
          citations: [
            { url: 'https://acme.com', title: 'Link 1' }, // 1 citation -> 15 points
          ],
        };
        // totalCitations = 1, citationCount = 1
        // citation ratio = 1/1 * 15 = 15 points
        // sentiment = neutral, mentionCount > 0 -> 7 points
        // Expected score = 20 + 15 + 15 + 7 = 57
        const result = parseResponse(response, brand, 'neutral');
        expect(result.visibilityScore).toBe(57);
      });

      it('should compute score with negative sentiment', () => {
        const response = {
          text: 'Acme Acme', // 2 mentions -> 20 points
          citations: [
            { url: 'https://acme.com', title: 'Link 1' }, // 1 citation -> 15 points
          ],
        };
        // totalCitations = 1, citationCount = 1
        // citation ratio = 1/1 * 15 = 15 points
        // sentiment = negative -> 0 points
        // Expected score = 20 + 15 + 15 + 0 = 50
        const result = parseResponse(response, brand, 'negative');
        expect(result.visibilityScore).toBe(50);
      });

      it('should cap the visibility score at 100', () => {
        const response = {
          text: 'Acme Acme Acme Acme Acme Acme', // 6 mentions -> capped at 40
          citations: [
            { url: 'https://acme.com', title: 'Link 1' }, // 2 citations -> capped at 30
            { url: 'https://acme-corp.com', title: 'Link 2' },
          ],
        };
        // totalCitations = 2, citationCount = 2
        // citation ratio = 2/2 * 15 = 15 points
        // sentiment = positive -> 15 points
        // Total before cap: 40 + 30 + 15 + 15 = 100
        const result = parseResponse(response, brand, 'positive');
        expect(result.visibilityScore).toBe(100);
      });
    });

    describe('competitor mentions', () => {
      const competitors = [
        { id: '1', name: 'Globex', domain: 'globex.com' },
        { id: '2', name: 'Initech', domain: '' }, // missing domain
      ];

      it('should compute metrics for each competitor', () => {
        const response = {
          text: 'Globex is alright, but Initech is better. Check globex.com or initech.org.',
          citations: [
            { url: 'https://globex.com/about', title: 'Globex Inc' },
            { url: 'https://initech.org/info', title: 'Initech Inc' },
          ],
        };
        const result = parseResponse(response, brand, 'neutral', competitors);

        // Competitor 1 (Globex):
        // Name: Globex (1 mention + 1 matching inside globex.com due to word boundaries = 2 mentions)
        // Domain: globex.com (1 mention)
        // Total = 3 mentions
        // Citations: globex.com matches 1 citation -> total 1 citation
        // score logic for competitor:
        //   mention component: Math.min(3 * 10, 40) = 30
        //   citation component: Math.min(1 * 15, 30) = 15
        //   citation ratio bonus: Math.round((1 / 2) * 15) = 8
        //   sentiment is always neutral, mentions = 3 > 0 -> 7
        //   expected score = 30 + 15 + 8 + 7 = 60
        const globexResult = result.competitorMentions.find((c) => c.competitor_id === '1');
        expect(globexResult).toBeDefined();
        expect(globexResult.name).toBe('Globex');
        expect(globexResult.domain).toBe('globex.com');
        expect(globexResult.mention_count).toBe(3);
        expect(globexResult.citation_count).toBe(1);
        expect(globexResult.visibility_score).toBe(60);

        // Competitor 2 (Initech):
        // Name: Initech (1 mention + 1 matching inside initech.org due to word boundaries = 2 mentions)
        // Domain: "" (ignored)
        // Citations: domain is empty -> total 0 citations
        // score logic for competitor:
        //   mention component: Math.min(2 * 10, 40) = 20
        //   citation component: Math.min(0 * 15, 30) = 0
        //   citation ratio bonus: 0
        //   sentiment is always neutral, mentions = 2 > 0 -> 7
        //   expected score = 20 + 0 + 0 + 7 = 27
        const initechResult = result.competitorMentions.find((c) => c.competitor_id === '2');
        expect(initechResult).toBeDefined();
        expect(initechResult.name).toBe('Initech');
        expect(initechResult.domain).toBe('');
        expect(initechResult.mention_count).toBe(2);
        expect(initechResult.citation_count).toBe(0);
        expect(initechResult.visibility_score).toBe(27);
      });
    });

    describe('edge cases', () => {
      it('should handle empty text and citations gracefully', () => {
        const response = {
          text: '',
          citations: [],
        };
        const result = parseResponse(response, brand, 'neutral');
        expect(result.mentionCount).toBe(0);
        expect(result.citationCount).toBe(0);
        expect(result.visibilityScore).toBe(0);
        expect(result.competitorMentions).toEqual([]);
      });

      it('should handle zero mentions and zero citations with non-zero total citations', () => {
        const response = {
          text: 'Completely unrelated text about other things.',
          citations: [{ url: 'https://unrelated.com', title: 'Unrelated' }],
        };
        const result = parseResponse(response, brand, 'neutral');
        expect(result.mentionCount).toBe(0);
        expect(result.citationCount).toBe(0);
        expect(result.visibilityScore).toBe(0);
      });
    });
  });
});
