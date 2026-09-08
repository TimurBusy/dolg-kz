import fontkit from '@pdf-lib/fontkit';
import { Injectable } from '@nestjs/common';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { PDFDocument, rgb } from 'pdf-lib';

type AgreementParty = {
  fullName: string;
  iin: string;
  phone: string;
};

export type LoanAgreementInput = {
  number: string;
  lender: AgreementParty;
  borrower: AgreementParty;
  principalAmount: number;
  currency: string;
  issuedAt?: Date | null;
  dueDate: Date;
  purpose?: string | null;
};

const require = createRequire(import.meta.url);

@Injectable()
export class LoanAgreementPdfService {
  private regularFontBytes?: Promise<Buffer>;
  private boldFontBytes?: Promise<Buffer>;

  async generate(input: LoanAgreementInput) {
    const pdf = await PDFDocument.create();
    pdf.registerFontkit(fontkit);

    const regular = await pdf.embedFont(await this.loadRegularFont(), { subset: true });
    const bold = await pdf.embedFont(await this.loadBoldFont(), { subset: true });

    let page = pdf.addPage([595.28, 841.89]);
    let y = 790;

    const nextPage = () => {
      page = pdf.addPage([595.28, 841.89]);
      y = 790;
    };

    const ensureSpace = (height: number) => {
      if (y - height < 55) nextPage();
    };

    const drawLine = (
      text: string,
      options: { size?: number; bold?: boolean; center?: boolean; gapAfter?: number } = {},
    ) => {
      const size = options.size ?? 10.5;
      const font = options.bold ? bold : regular;
      const lineHeight = size * 1.42;
      ensureSpace(lineHeight + (options.gapAfter ?? 0));
      const width = font.widthOfTextAtSize(text, size);
      const x = options.center ? Math.max(50, (595.28 - width) / 2) : 50;
      page.drawText(text, { x, y, size, font, color: rgb(0.08, 0.09, 0.11) });
      y -= lineHeight + (options.gapAfter ?? 0);
    };

    const drawParagraph = (text: string, gapAfter = 10) => {
      const size = 10.5;
      const font = regular;
      const maxWidth = 495;
      const words = text.split(/\s+/);
      let line = '';

      for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
          line = candidate;
          continue;
        }
        drawLine(line, { size });
        line = word;
      }
      if (line) drawLine(line, { size, gapAfter });
    };

    const money = new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(input.principalAmount);
    const formatDate = (date: Date) =>
      new Intl.DateTimeFormat('ru-RU', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      }).format(date);

    drawLine('ДОГОВОР ЗАЙМА', { size: 16, bold: true, center: true, gapAfter: 2 });
    drawLine(`№ ${input.number}`, { size: 11, center: true, gapAfter: 14 });
    drawLine(`Дата формирования: ${formatDate(new Date())}`, { size: 9.5, gapAfter: 12 });

    drawParagraph(
      `${input.lender.fullName}, ИИН ${input.lender.iin}, телефон ${input.lender.phone}, далее — «Заимодатель», и ${input.borrower.fullName}, ИИН ${input.borrower.iin}, телефон ${input.borrower.phone}, далее — «Заёмщик», совместно именуемые «Стороны», заключили настоящий договор займа.`,
    );

    drawLine('1. Предмет договора', { size: 11.5, bold: true, gapAfter: 6 });
    drawParagraph(
      `1.1. Заимодатель передаёт Заёмщику денежные средства в размере ${money} ${input.currency}, а Заёмщик обязуется вернуть указанную сумму не позднее ${formatDate(input.dueDate)}.`,
    );
    drawParagraph(
      input.purpose
        ? `1.2. Назначение займа: ${input.purpose}.`
        : '1.2. Займ предоставляется без указания специального целевого назначения.',
    );
    drawParagraph('1.3. Займ является беспроцентным. Вознаграждение за пользование займом не начисляется.');

    drawLine('2. Передача денежных средств', { size: 11.5, bold: true, gapAfter: 6 });
    drawParagraph(
      `2.1. Факт передачи денежных средств подтверждается отдельным подтверждением в Dolg.kz и/или банковским документом. Планируемая дата передачи: ${input.issuedAt ? formatDate(input.issuedAt) : 'после подписания договора'}.`,
    );
    drawParagraph(
      '2.2. Если денежные средства фактически не были переданы, Стороны обязуются зафиксировать это в сервисе и не использовать настоящий документ как подтверждение состоявшейся передачи.',
    );

    drawLine('3. Возврат займа', { size: 11.5, bold: true, gapAfter: 6 });
    drawParagraph(
      '3.1. Заёмщик вправе возвратить сумму займа досрочно полностью или частями. Каждый возврат рекомендуется подтверждать банковским документом и подтверждением Заимодателя в Dolg.kz.',
    );
    drawParagraph(
      '3.2. После полного возврата суммы займа Заимодатель подтверждает исполнение обязательства в сервисе.',
    );

    drawLine('4. Электронное подписание и доказательства', { size: 11.5, bold: true, gapAfter: 6 });
    drawParagraph(
      '4.1. Стороны намерены подписать настоящий документ электронными подписями через поддерживаемую Dolg.kz инфраструктуру. После первой электронной подписи содержание подписываемой версии документа блокируется от изменения.',
    );
    drawParagraph(
      '4.2. Dolg.kz сохраняет хэш файла, сведения о версии документа и техническую историю операций. Закрытые ключи электронной подписи пользователей сервисом не хранятся.',
    );

    drawLine('5. Заключительные положения', { size: 11.5, bold: true, gapAfter: 6 });
    drawParagraph(
      '5.1. Изменение существенных условий после подписания оформляется отдельным дополнительным соглашением, подписываемым обеими Сторонами.',
    );
    drawParagraph(
      '5.2. Споры разрешаются путём переговоров, а при недостижении соглашения — в порядке, предусмотренном законодательством Республики Казахстан.',
    );

    drawLine('Реквизиты сторон', { size: 11.5, bold: true, gapAfter: 8 });
    drawParagraph(`Заимодатель: ${input.lender.fullName}; ИИН: ${input.lender.iin}; телефон: ${input.lender.phone}.`, 4);
    drawParagraph(`Заёмщик: ${input.borrower.fullName}; ИИН: ${input.borrower.iin}; телефон: ${input.borrower.phone}.`, 12);

    drawLine('Сформировано Dolg.kz · версия шаблона 0.1', {
      size: 8.5,
      center: true,
    });

    const bytes = await pdf.save();
    return Buffer.from(bytes);
  }

  private loadRegularFont() {
    this.regularFontBytes ??= (async () => {
      const path = require.resolve('dejavu-fonts-ttf/ttf/DejaVuSans.ttf');
      return readFile(path);
    })();
    return this.regularFontBytes;
  }

  private loadBoldFont() {
    this.boldFontBytes ??= (async () => {
      const path = require.resolve('dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf');
      return readFile(path);
    })();
    return this.boldFontBytes;
  }
}
