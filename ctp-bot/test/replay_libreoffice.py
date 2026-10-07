"""Dựng lại file xuất trên file mẫu .xlsx THẬT bằng LibreOffice, từ các thao tác Code.gs đã làm trong bản giả lập.

  soffice --headless --invisible --norestore --accept="socket,host=localhost,port=2002;urp;" &
  python3 replay_libreoffice.py mau.xlsx ops.json out.pdf ["20 15 20 30"]

LibreOffice tự tính lại mọi công thức (kể cả công thức gốc của mẫu, tự dời khi chèn/xóa dòng như Google Sheets),
nên đây là phép thử độc lập cho tổng tiền, và cho ra bản PDF để xem trước.
"""
import json, sys, time, os
import uno
from com.sun.star.beans import PropertyValue
from com.sun.star.lang import Locale


def pv(name, value):
    p = PropertyValue(); p.Name = name; p.Value = value; return p


def connect():
    local = uno.getComponentContext()
    resolver = local.ServiceManager.createInstanceWithContext('com.sun.star.bridge.UnoUrlResolver', local)
    for _ in range(60):
        try:
            return resolver.resolve('uno:socket,host=localhost,port=2002;urp;StarOffice.ComponentContext')
        except Exception:
            time.sleep(0.5)
    raise SystemExit('Không kết nối được LibreOffice')


def main(src, ops_path, out_pdf, le=None):
    ctx = connect()
    desktop = ctx.ServiceManager.createInstanceWithContext('com.sun.star.frame.Desktop', ctx)
    doc = desktop.loadComponentFromURL(uno.systemPathToFileUrl(os.path.abspath(src)), '_blank', 0, (pv('Hidden', True),))
    sheets = doc.Sheets
    ops = json.load(open(ops_path))
    fmts = doc.NumberFormats
    key_text = fmts.queryKey('@', Locale(), False)
    if key_text == -1:
        key_text = fmts.addNew('@', Locale())

    def rng(sh, r, c, nr=1, nc=1):
        return sh.getCellRangeByPosition(c - 1, r - 1, c - 1 + nc - 1, r - 1 + nr - 1)

    for o in ops:
        name = o['sheet']
        if o['op'] == 'deleteSheet':
            sheets.removeByName(name); continue
        sh = sheets.getByName(name)
        op = o['op']
        if op == 'showSheet':
            sh.IsVisible = True
        elif op == 'insertRowsAfter':
            sh.Rows.insertByIndex(o['r'], o['k'])
        elif op == 'insertRowsBefore':
            sh.Rows.insertByIndex(o['r'] - 1, o['k'])
        elif op == 'deleteRows':
            sh.Rows.removeByIndex(o['r'] - 1, o['k'])
        elif op == 'unmerge':
            for m in o['ranges']:
                rng(sh, m[0], m[1], m[2] - m[0] + 1, m[3] - m[1] + 1).merge(False)
        elif op == 'merge':
            m = o['range']; rng(sh, m[0], m[1], m[2] - m[0] + 1, m[3] - m[1] + 1).merge(True)
        elif op == 'copyFormat':
            s, d = o['src'], o['dst']
            src_addr = rng(sh, *s).getRangeAddress()
            for i in range(d[2]):
                a = uno.createUnoStruct('com.sun.star.table.CellAddress')
                a.Sheet = src_addr.Sheet; a.Column = d[1] - 1; a.Row = d[0] - 1 + i
                sh.copyRange(a, src_addr)
        elif op == 'setRowHeights':
            for i in range(o['k']):
                sh.Rows.getByIndex(o['r'] - 1 + i).Height = int(o['h'] * 35.28)  # điểm → 1/100 mm
        elif op == 'autoResizeRows':
            for i in range(o['k']):
                sh.Rows.getByIndex(o['r'] - 1 + i).OptimalHeight = True
        elif op == 'halign':
            rng(sh, o['r'], o['c'], o['nr'], o['nc']).HoriJustify = 2
        elif op == 'valign':
            rng(sh, o['r'], o['c'], o['nr'], o['nc']).VertJustify = 2
        elif op == 'setNumberFormat':
            if o['f'] == '@':
                rng(sh, o['r'], o['c'], o['nr'], o['nc']).NumberFormat = key_text
        elif op == 'clearContent':
            rng(sh, o['r'], o['c'], o['nr'], o['nc']).clearContents(1 | 2 | 4 | 16)
        elif op == 'setValues':
            for i, row in enumerate(o['values']):
                for j, v in enumerate(row):
                    cell = sh.getCellByPosition(o['c'] - 1 + j, o['r'] - 1 + i)
                    if isinstance(v, str) and v.startswith('='):
                        cell.setFormula(v.replace(',', ';'))
                    elif isinstance(v, (int, float)) and not isinstance(v, bool):
                        cell.setValue(v)
                    elif v == '' or v is None:
                        cell.setString('')
                    else:
                        cell.setString(str(v))
        else:
            raise SystemExit('thao tác lạ: ' + op)
    doc.calculateAll()
    # Giả lập export của Google: lề (mm) + co vừa khổ ngang (fitw=true), căn giữa ngang
    if le:
        t, r, b, l = le
        for name in sheets.ElementNames:
            ps = doc.StyleFamilies.getByName('PageStyles').getByName(sheets.getByName(name).PageStyle)
            ps.TopMargin, ps.RightMargin, ps.BottomMargin, ps.LeftMargin = [int(v * 100) for v in (t, r, b, l)]
            ps.ScaleToPagesX, ps.ScaleToPagesY, ps.CenterHorizontally = 1, 0, True

    # In ra các con số chính để đối chiếu
    for name in [s for s in sheets.ElementNames]:
        sh = sheets.getByName(name)
        cur = sh.createCursor(); cur.gotoEndOfUsedArea(False)
        last_r, last_c = cur.RangeAddress.EndRow, cur.RangeAddress.EndColumn
        print('=== ' + name)
        for r in range(last_r + 1):
            vals = []
            for c in range(min(last_c, 10) + 1):
                cell = sh.getCellByPosition(c, r)
                s = cell.getString()
                if s:
                    vals.append('%s%d=%s' % (chr(65 + c), r + 1, s.replace('\n', ' ')[:60]))
            if vals:
                print('  ' + ' | '.join(vals))
    doc.storeToURL(uno.systemPathToFileUrl(os.path.abspath(out_pdf)), (pv('FilterName', 'calc_pdf_Export'),))
    doc.storeToURL(uno.systemPathToFileUrl(os.path.abspath(out_pdf[:-4] + '.xlsx')), (pv('FilterName', 'Calc MS Excel 2007 XML'),))
    doc.close(True)


if __name__ == '__main__':
    # tùy chọn thứ 4: lề "trên phải dưới trái" (mm) để giả lập PDF Google xuất
    main(*sys.argv[1:4], le=[float(x) for x in sys.argv[4].split()] if len(sys.argv) > 4 else None)
