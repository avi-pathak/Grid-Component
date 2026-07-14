import { describe, it, expect } from 'vitest';
import { csvFormat } from './formats/csv';
import { xlsxFormat } from './formats/xlsx';
import { pdfFormat } from './formats/pdf';
import { ExportData } from './types';

const data: ExportData = {
  columns: [
    { header: 'ID', key: 'id', type: 'Number', align: 'right', width: 60 },
    { header: 'Name', key: 'name', type: 'String', align: 'left', width: 120 },
    { header: 'Active', key: 'active', type: 'Boolean', align: 'center', width: 80 },
  ],
  rows: [
    {
      kind: 'data',
      cells: [
        { value: 1, text: '1', type: 'Number', align: 'right' },
        { value: 'A, "B"', text: 'A, "B"', type: 'String', align: 'left' },
        { value: true, text: 'TRUE', type: 'Boolean', align: 'center' },
      ],
    },
    {
      kind: 'data',
      cells: [
        { value: 2, text: '2', type: 'Number', align: 'right' },
        { value: 'line\nbreak', text: 'line\nbreak', type: 'String', align: 'left' },
        { value: false, text: 'FALSE', type: 'Boolean', align: 'center' },
      ],
    },
  ],
};

describe('csvFormat', () => {
  it('emits a header row and RFC-4180-escaped fields', () => {
    const out = csvFormat.render(data, {}) as string;
    const noBom = out.replace(/^\uFEFF/, '');
    const lines = noBom.split('\r\n');
    expect(lines[0]).toBe('ID,Name,Active');
    // Comma + quote → wrapped and inner quotes doubled.
    expect(lines[1]).toBe('1,"A, ""B""",TRUE');
    // Embedded newline → field is quoted.
    expect(lines[2]).toContain('"line\nbreak"');
  });

  it('prefixes a UTF-8 BOM by default and honors options', () => {
    expect((csvFormat.render(data, {}) as string).charCodeAt(0)).toBe(0xfeff);
    const noBom = csvFormat.render(data, { csv: { bom: false } }) as string;
    expect(noBom.charCodeAt(0)).not.toBe(0xfeff);
    const semi = csvFormat.render(data, { csv: { bom: false, delimiter: ';' } }) as string;
    expect(semi.split('\r\n')[0]).toBe('ID;Name;Active');
  });

  it('omits the header row when includeHeaders is false', () => {
    const out = (csvFormat.render(data, { includeHeaders: false }) as string).replace(
      /^\uFEFF/,
      '',
    );
    expect(out.split('\r\n')[0]).toBe('1,"A, ""B""",TRUE');
  });
});

describe('xlsxFormat', () => {
  it('produces a ZIP (PK signature) with the required OPC parts', () => {
    const bytes = xlsxFormat.render(data, {}) as Uint8Array;
    expect(bytes[0]).toBe(0x50); // 'P'
    expect(bytes[1]).toBe(0x4b); // 'K'
    const text = new TextDecoder('latin1').decode(bytes);
    expect(text).toContain('[Content_Types].xml');
    expect(text).toContain('xl/workbook.xml');
    expect(text).toContain('xl/worksheets/sheet1.xml');
    expect(text).toContain('xl/styles.xml');
  });

  it('types cells: numbers as <v>, booleans as t="b", strings inline', () => {
    const bytes = xlsxFormat.render(data, {}) as Uint8Array;
    const text = new TextDecoder('latin1').decode(bytes);
    expect(text).toContain('<c r="A2"><v>1</v></c>'); // number, row 2 (after header)
    expect(text).toContain('t="b"><v>1</v>'); // boolean true
    expect(text).toContain('t="inlineStr"'); // string cell
    // XML-escaped inline string.
    expect(text).toContain('A, &quot;B&quot;');
  });

  it('encodes dates as serial numbers with the date style', () => {
    const dateData: ExportData = {
      columns: [{ header: 'D', key: 'd', type: 'Date', align: 'right', width: 100 }],
      rows: [
        {
          kind: 'data',
          cells: [{ value: new Date(2020, 0, 1), text: '1/1/2020', type: 'Date', align: 'right' }],
        },
      ],
    };
    const text = new TextDecoder('latin1').decode(xlsxFormat.render(dateData, {}) as Uint8Array);
    // 2020-01-01 is serial 43831 in the 1900 date system.
    expect(text).toContain('<v>43831</v>');
    expect(text).toContain('s="2"'); // date style index
  });
});

describe('pdfFormat', () => {
  it('produces a valid PDF header, font, and EOF', () => {
    const bytes = pdfFormat.render(data, {}) as Uint8Array;
    const text = new TextDecoder('latin1').decode(bytes);
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text).toContain('/Type /Catalog');
    expect(text).toContain('/BaseFont /Helvetica');
    expect(text).toContain('xref');
    expect(text).toContain('trailer');
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
  });

  it('escapes parentheses in drawn text', () => {
    const parenData: ExportData = {
      columns: [{ header: 'H', key: 'h', type: 'String', align: 'left', width: 100 }],
      rows: [
        { kind: 'data', cells: [{ value: 'a(b)c', text: 'a(b)c', type: 'String', align: 'left' }] },
      ],
    };
    const text = new TextDecoder('latin1').decode(pdfFormat.render(parenData, {}) as Uint8Array);
    expect(text).toContain('a\\(b\\)c');
  });
});

describe('xlsx cell styling', () => {
  const styled: ExportData = {
    columns: [
      { header: 'Name', key: 'name', type: 'String', align: 'left', width: 120 },
      { header: 'Amt', key: 'amt', type: 'Number', align: 'right', width: 90 },
    ],
    rows: [
      {
        kind: 'data',
        cells: [
          {
            value: 'A',
            text: 'A',
            type: 'String',
            align: 'left',
            style: { bold: true, color: 'red' },
          },
          { value: 5, text: '5', type: 'Number', align: 'right', style: { background: '#00ff00' } },
        ],
      },
    ],
  };

  it('emits bold and colored fonts plus solid fills in styles.xml', () => {
    const text = new TextDecoder('latin1').decode(xlsxFormat.render(styled, {}) as Uint8Array);
    expect(text).toMatch(/<font><b\/><sz val="11"\/><color rgb="FFFF0000"\/>/);
    expect(text).toContain('patternType="solid"><fgColor rgb="FF00FF00"');
    expect(text).toMatch(/<c r="A2" s="\d+"/);
  });

  it('keeps the number cell typed while styled', () => {
    const text = new TextDecoder('latin1').decode(xlsxFormat.render(styled, {}) as Uint8Array);
    expect(text).toMatch(/<c r="B2" s="\d+"><v>5<\/v><\/c>/);
  });

  it('pdf includes a bold font resource', () => {
    const text = new TextDecoder('latin1').decode(pdfFormat.render(styled, {}) as Uint8Array);
    expect(text).toContain('/BaseFont /Helvetica-Bold');
  });
});

describe('xlsx autofilter and row outline', () => {
  const filtered: ExportData = {
    columns: [
      { header: 'A', key: 'a', type: 'String', align: 'left', width: 100 },
      { header: 'B', key: 'b', type: 'Number', align: 'right', width: 100 },
    ],
    rows: [{ kind: 'data', cells: [
      { value: 'x', text: 'x', type: 'String', align: 'left' },
      { value: 1, text: '1', type: 'Number', align: 'right' },
    ] }],
    autoFilter: true,
  };

  it('emits an autoFilter over the header + data range', () => {
    const xml = new TextDecoder('latin1').decode(xlsxFormat.render(filtered, {}) as Uint8Array);
    expect(xml).toContain('<autoFilter ref="A1:B2"/>');
  });

  it('omits autoFilter when disabled or headers are off', () => {
    const noFilter = new TextDecoder('latin1').decode(
      xlsxFormat.render({ ...filtered, autoFilter: false }, {}) as Uint8Array,
    );
    expect(noFilter).not.toContain('<autoFilter');
    const noHeaders = new TextDecoder('latin1').decode(
      xlsxFormat.render(filtered, { includeHeaders: false }) as Uint8Array,
    );
    expect(noHeaders).not.toContain('<autoFilter');
  });

  it('emits outline levels and outlinePr for grouped rows', () => {
    const outlined: ExportData = {
      columns: [{ header: 'A', key: 'a', type: 'String', align: 'left', width: 100 }],
      rows: [
        { kind: 'group', cells: [{ value: 'G', text: 'G (2)', type: 'String', align: 'left' }], level: 0 },
        { kind: 'data', cells: [{ value: 'x', text: 'x', type: 'String', align: 'left' }], level: 1 },
        { kind: 'data', cells: [{ value: 'y', text: 'y', type: 'String', align: 'left' }], level: 1 },
      ],
      outline: true,
      outlineLevels: 1,
    };
    const xml = new TextDecoder('latin1').decode(xlsxFormat.render(outlined, {}) as Uint8Array);
    expect(xml).toContain('<outlinePr');
    expect(xml).toContain('outlineLevelRow="1"');
    expect(xml).toMatch(/<row r="3" outlineLevel="1">/); // first data row (after header + group)
  });
});
